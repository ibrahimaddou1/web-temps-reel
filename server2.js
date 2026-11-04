const express = require("express");
const app = express();
app.use(express.json());
require("./handshake")(app, {
  origin: process.env.PUBLIC_URL || "http://172.20.10.2:3001",
  peer: process.env.PEER_URL || "http://172.20.10.2:3000",
});
app.get("/", (req, res) => res.json({ message: "API 2 fonctionne !" }));
app.listen(3001, () => console.log("API 2 sur le port 3001"));
