const axios = require("axios");

// Les deux API utilisent le même contrat et peuvent lancer ou recevoir un SYN.
module.exports = function installerHandshake(app, { origin, peer }) {
  function lireOrigin(value) {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Origin doit contenir uniquement http(s)://hote:port");
    }
    return url.origin;
  }

  const adresse = lireOrigin(origin);
  const cible = lireOrigin(peer);
  const connexions = new Map();

  function etat(url, valeur) {
    connexions.set(url, { url, etat: valeur });
    console.log(`[${adresse}] ${url} : ${valeur}`);
  }

  async function envoyer(url, route, attente, suite) {
    try {
      await axios.post(`${url}${route}`, {}, {
        headers: { Origin: adresse }, timeout: 5000, proxy: false,
      });
      // Un callback peut déjà avoir fait avancer l'état entre-temps.
      if (suite && connexions.get(url)?.etat === attente) etat(url, suite);
    } catch (error) {
      etat(url, "ECHEC");
      console.error(`Échec ${route} :`, error.message);
    }
  }

  app.get("/connexions", (req, res) => res.json([...connexions.values()]));

  app.post("/handshake", (req, res) => {
    const actuel = connexions.get(cible)?.etat;
    if (["SYN_ENVOYE", "SYN_ACK_ENVOYE", "ACK_ENVOYE"].includes(actuel)) {
      return res.status(409).json({ error: "Échange déjà en cours" });
    }
    etat(cible, "SYN_ENVOYE");
    res.status(202).json({ message: "Échange lancé", peer: cible });
    void envoyer(cible, "/syn");
  });

  function recevoir(route, attendu, suivant, callback) {
    app.post(route, (req, res) => {
      let url;
      try { url = lireOrigin(req.get("Origin")); }
      catch { return res.status(400).json({ error: "Header Origin absent ou invalide" }); }
      if (attendu && connexions.get(url)?.etat !== attendu) {
        return res.status(409).json({ error: `État attendu : ${attendu}` });
      }
      etat(url, suivant);
      // Envoyer le 200 avant de lancer la requête suivante.
      if (callback) res.once("finish", () => callback(url));
      res.sendStatus(200);
    });
  }

  recevoir("/syn", null, "SYN_ACK_ENVOYE", (url) => envoyer(url, "/syn-ack"));
  recevoir("/syn-ack", "SYN_ENVOYE", "ACK_ENVOYE", (url) =>
    envoyer(url, "/ack", "ACK_ENVOYE", "ETABLI"));
  recevoir("/ack", "SYN_ACK_ENVOYE", "ETABLI");
};
