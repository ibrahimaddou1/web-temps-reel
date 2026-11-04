const express = require("express");
const { randomUUID } = require("crypto");

const app = express();
app.use(express.json());

// Une session attend son ACK pendant 10 secondes.
const pendingSessions = new Set();

app.get("/", (req, res) => {
  res.json({ message: "API 2 fonctionne !" });
});

app.post("/syn", (req, res) => {
  if (req.body?.type !== "SYN") {
    return res.status(400).json({ error: "Message SYN attendu" });
  }

  const sessionId = randomUUID();
  pendingSessions.add(sessionId);
  setTimeout(() => pendingSessions.delete(sessionId), 10000).unref();
  console.log("[1] SYN reçu de API 1");
  console.log("[2] SYN-ACK envoyé à API 1, en attente de ACK");
  res.json({ type: "SYN-ACK", sessionId });
});

app.post("/ack", (req, res) => {
  if (req.body?.type !== "ACK" || !pendingSessions.has(req.body?.sessionId)) {
    return res.status(400).json({ error: "ACK invalide ou session expirée" });
  }

  pendingSessions.delete(req.body.sessionId);
  console.log("[3] ACK reçu : échange établi !");
  res.json({ sessionId: req.body.sessionId, status: "ESTABLISHED" });
});

app.listen(3001, () => {
  console.log("API 2 démarrée sur http://localhost:3001");
});
