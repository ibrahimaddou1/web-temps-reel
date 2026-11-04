
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

require("./handshake")(app, {
  origin: process.env.PUBLIC_URL || "http://172.20.10.2:3000",
  peer: process.env.PEER_URL || "http://172.20.10.4:3001",
});

// Création du serveur HTTP
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

// Route HTTP
app.get("/", (req, res) => {
    res.json({
        message: "Serveur Chat opérationnel !"
    });
});

// Nombre de clients connectés
app.get("/users", (req, res) => {
    res.json({
        connectedClients: wss.clients.size
    });
});

// Connexion WebSocket
let nextClientId = 1;
wss.on("connection", (ws) => {
    const clientId = nextClientId++;
    console.log(`Client ${clientId} connecté (${wss.clients.size} connecté(s))`);

    // Réception des messages
    ws.on("message", (data) => {

        try {
            const message = JSON.parse(data.toString());

            console.log(
                `${message.username} : ${message.text}`
            );

            // Diffuser le message à tous les clients
            wss.clients.forEach((client) => {

                if (client.readyState === WebSocket.OPEN) {

                    client.send(JSON.stringify({
                        username: message.username,
                        text: message.text,
                        date: new Date().toLocaleTimeString()
                    }));

                }

            });

        } catch (error) {
            console.error("Message invalide :", error.message);
        }

    });

    // Déconnexion
    ws.on("close", (code, reason) => {
        const text = `Client ${clientId} déconnecté (${wss.clients.size} connecté(s))`;
        console.log(`${text} — code : ${code}, raison : ${reason.toString() || "aucune"}`);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ username: "Serveur", text, date: new Date().toLocaleTimeString() }));
            }
        });
    });

    ws.on("error", (error) => {
        console.error(`Erreur du client ${clientId} :`, error.message);
    });

});

// Démarrage
server.listen(3000, () => {
    console.log("Serveur HTTP : http://localhost:3000");
    console.log("WebSocket : ws://localhost:3000");
});
