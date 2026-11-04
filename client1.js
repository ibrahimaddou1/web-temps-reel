
const axios = require("axios");
const WebSocket = require("ws");

// 1. Tester une API REST avec Axios
async function testAxios() {
  try {
    const response = await axios.get(
      "http://localhost:3000/users"
    );

    console.log("Réponse HTTP :", response.data);
  } catch (error) {
    console.error("Erreur Axios :", error.message);
  }
}

// 2. Tester WebSocket
function testWebSocket() {
  const ws = new WebSocket("ws://localhost:3000");

  // Connexion établie
  ws.on("open", () => {
    console.log("WebSocket connecté !");

    // Envoyer un message au serveur
    ws.send("Bonjour serveur !");
  });

  // Recevoir les messages
  ws.on("message", (message) => {
    console.log("Message du serveur :", message.toString());
  });

  // Déconnexion
  ws.on("close", () => {
    console.log("Connexion fermée");
  });

  ws.on("error", (error) => {
    console.error("Erreur WebSocket :", error.message);
  });
}

// Exécution
testAxios();
testWebSocket();
