const express = require("express");
const app = express();
app.use(express.json());
require("./handshake")(app, {
  origin: process.argv[3] || process.env.PUBLIC_URL,
  peer: process.argv[2] || process.env.PEER_URL,
});
app.get("/", (req, res) => res.json({ message: "API 2 fonctionne !" }));
app.listen(3001, () => console.log("API 2 sur le port 3001"));
