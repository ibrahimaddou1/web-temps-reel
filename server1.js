
const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocket, WebSocketServer } = require("ws");

const app = express();

app.use(cors());
app.use(express.json());

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
