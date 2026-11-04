
const express = require("express");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const app = express();

app.use(cors());
app.use(express.json());

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

// Envoyer uniquement aux connexions encore ouvertes.
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

let nextClientId = 1;

// Gestion des connexions WebSocket
wss.on("connection", (ws) => {
  const clientId = nextClientId++;
  console.log(`Client ${clientId} connecté (${wss.clients.size} connecté(s))`);
// Connexion WebSocket
wss.on("connection", (ws) => {


    console.log("Nouveau client connecté");

    // Réception des messages
    ws.on("message", (data) => {

        try {
            const message = JSON.parse(data.toString());

            console.log(
                `${message.username} : ${message.text}`
            );

            // Diffuser le message à tous les clients
            wss.clients.forEach((client) => {

                if (client.readyState === 1) {

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

    // Diffuser le message à tous les clients, y compris l'expéditeur
    broadcast(message.toString());
  });

  // Déconnexion
  ws.on("close", (code, reason) => {
    // ws retire automatiquement cette connexion de wss.clients.
    const notification = `Client ${clientId} déconnecté (${wss.clients.size} connecté(s))`;
    console.log(`${notification} — code : ${code}, raison : ${reason.toString() || "aucune"}`);
    broadcast(notification);
  });

  ws.on("error", (error) => {
    console.error(`Erreur du client ${clientId} :`, error.message);
  });
    // Déconnexion
    ws.on("close", () => {
        console.log("Un client est déconnecté");
    });

});

// Démarrage
server.listen(3000, () => {
    console.log("Serveur HTTP : http://localhost:3000");
    console.log("WebSocket : ws://localhost:3000");
});
