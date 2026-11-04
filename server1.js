
const express = require("express");
const http = require("http");
const cors = require("cors");
const axios = require("axios");
const { WebSocket, WebSocketServer } = require("ws");

const app = express();

app.use(cors());
app.use(express.json());

// Une nouvelle connexion TCP réelle est créée pour chaque appel.
// Le système effectue SYN / SYN-ACK / ACK avant d'envoyer la requête HTTP.
app.post("/tcp", async (req, res) => {
  const agent = new http.Agent({ keepAlive: false });
  try {
    const response = await axios.get("http://127.0.0.1:3001/", {
      httpAgent: agent,
      proxy: false,
      timeout: 5000,
    });
    res.json({
      message: "API 2 contactée via une nouvelle connexion TCP réelle",
      api2: response.data,
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  } finally {
    agent.destroy();
  }
});

// Simulation pédagogique : API 1 initie les trois étapes vers API 2.
app.post("/handshake", async (req, res) => {
  try {
    console.log("[1] API 1 → API 2 : SYN");
    const { data } = await axios.post("http://localhost:3001/syn", {
      type: "SYN",
    }, { timeout: 5000 });

    if (data.type !== "SYN-ACK" || !data.sessionId) {
      throw new Error("SYN-ACK invalide");
    }
    console.log("[2] API 2 → API 1 : SYN-ACK");
    console.log("[3] API 1 → API 2 : ACK");
    const response = await axios.post("http://localhost:3001/ack", {
      type: "ACK",
      sessionId: data.sessionId,
    }, { timeout: 5000 });
    res.json({ steps: ["SYN", "SYN-ACK", "ACK"], ...response.data });
  } catch (error) {
    console.error("Échec du handshake :", error.message);
    res.status(502).json({ error: "Handshake impossible avec API 2" });
  }
});

// Création du serveur HTTP
const server = http.createServer(app);

// Création du serveur WebSocket
const wss = new WebSocketServer({ server });

// Route REST classique
app.get("/", (req, res) => {
  res.json({
    message: "API Express fonctionne !",
  });
});

// Route pour tester Axios
app.get("/users", (req, res) => {
  res.json([
    { id: 1, name: "Ahmed" },
    { id: 2, name: "Sarah" },
  ]);
});

// Gestion des connexions WebSocket
wss.on("connection", (ws) => {
  console.log("Un client est connecté !");

  // Envoyer un message au client
  ws.send("Bienvenue sur le serveur WebSocket !");

  // Recevoir un message du client
  ws.on("message", (message) => {
    console.log("Message reçu :", message.toString());

    // Diffuser le message à tous les clients, y compris l'expéditeur
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  // Déconnexion
  ws.on("close", () => {
    console.log("Un client est déconnecté !");
  });
});

// Démarrer le serveur
server.listen(3000, () => {
  console.log("Serveur démarré sur http://localhost:3000");
  console.log("WebSocket disponible sur ws://localhost:3000");
});
