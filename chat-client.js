
const WebSocket = require("ws");
const readline = require("readline");

const username = process.argv[2] || "Utilisateur";

const ws = new WebSocket("ws://localhost:3000");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ws.on("open", () => {

    console.log(`Connecté au chat en tant que ${username}`);
    console.log("Écris un message et appuie sur Entrée.");

    rl.on("line", (text) => {

        if (text.trim() === "") return;

        ws.send(JSON.stringify({
            username: username,
            text: text
        }));

    });

});

ws.on("message", (data) => {

    const message = JSON.parse(data.toString());

    console.log(
        `\n[${message.date}] ${message.username} : ${message.text}`
    );

    rl.prompt();

});

ws.on("close", () => {
    console.log("Déconnecté du serveur.");
    rl.close();
});

ws.on("error", (error) => {
    console.error("Erreur :", error.message);
});
