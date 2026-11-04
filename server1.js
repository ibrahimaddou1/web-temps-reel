const socket = new WebSocket("wss://localhost:8080");

socket.addEventListener("open",    () => socket.send("Bonjour !"));
socket.addEventListener("message", (e) => console.log("Reçu :", e.data));
socket.addEventListener("close",   () => console.log("Connexion fermée"));