
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
