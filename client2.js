const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:3000");

ws.on("open", () => {
  console.log("Client 2 connecté !");
  ws.send("Bonjour serveur, ici le client 2 !");
});

ws.on("message", (message) => {
  console.log("Message du serveur :", message.toString());
});

ws.on("close", () => {
  console.log("Client 2 déconnecté");
});

ws.on("error", (error) => {
  console.error("Erreur WebSocket :", error.message);
});
