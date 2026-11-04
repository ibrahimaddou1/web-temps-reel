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

  if (!origin) {
    throw new Error("Adresse publique manquante : definir PUBLIC_URL ou passer les arguments <URL_CAMARADE> <MON_URL>.");
  }
  const adresse = lireOrigin(origin);
  const cibleParDefaut = peer ? lireOrigin(peer) : null;
  function choisirCible(req, res) {
    try {
      const valeur = req.body?.peer || cibleParDefaut;
      if (!valeur) throw new Error("Indiquer l'URL du camarade dans le champ JSON peer");
      return lireOrigin(valeur);
    } catch (error) {
      res.status(400).json({ error: error.message });
      return null;
    }
  }
  console.log(`[configuration] Notre adresse : ${adresse}`);
  console.log(`[configuration] Camarade par défaut : ${cibleParDefaut || "à choisir dans la requête"}`);
  const connexions = new Map();
  const surveillances = new Map();

  // Messages applicatifs : action choisie pour notre premier usage du contrat.
  app.post("/ingress", (req, res) => {
    let expediteur;
    try { expediteur = lireOrigin(req.get("Origin")); }
    catch { return res.status(400).json({ error: "Header Origin absent ou invalide" }); }

    if (req.body?.action !== "message") {
      return res.status(400).json({ error: "Action inconnue", actions: ["message"] });
    }
    const text = req.body?.payload?.text;
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "payload.text doit être un texte non vide" });
    }
    console.log(`[message] ${expediteur} : ${text}`);
    res.sendStatus(200);
  });

  function oublier(url) {
    const suivi = surveillances.get(url);
    if (suivi) clearTimeout(suivi.timer);
    surveillances.delete(url);
    connexions.delete(url);
    console.log(`[oubli] ${url}`);
  }

  // Avec Origin : demande distante. Sans Origin : lancement local.
  app.post("/forget", async (req, res) => {
    if (req.get("Origin") !== undefined) {
      let url;
      try { url = lireOrigin(req.get("Origin")); }
      catch { return res.status(400).json({ error: "Header Origin invalide" }); }
      oublier(url);
      return res.sendStatus(200);
    }
    const cible = choisirCible(req, res);
    if (!cible) return;
    oublier(cible);
    try {
      await axios.post(`${cible}/forget`, {}, {
        headers: { Origin: adresse }, timeout: 5000, proxy: false,
      });
      res.json({ oublie: cible, camaradePrevenu: true });
    } catch (error) {
      res.json({ oublie: cible, camaradePrevenu: false, detail: error.message });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", origin: adresse, uptime: process.uptime() });
  });

  function surveiller(url) {
    if (surveillances.has(url)) return;
    const suivi = { echecs: 0, timer: null };
    surveillances.set(url, suivi);

    async function verifier() {
      let delai = 5000;
      try {
        const response = await axios.get(`${url}/health`, {
          headers: { Origin: adresse }, timeout: 3000, proxy: false,
        });
        if (surveillances.get(url) !== suivi) return;
        if (response.data?.status !== "ok") throw new Error("Healthcheck invalide");
        suivi.echecs = 0;
        Object.assign(connexions.get(url), {
          sante: "DISPONIBLE", echecs: 0, derniereVerification: new Date().toISOString(),
          erreur: null, prochainEssaiMs: delai,
        });
        console.log(`[healthcheck] ${url} disponible`);
      } catch (error) {
        if (surveillances.get(url) !== suivi) return;
        suivi.echecs++;
        // exp_backoff : 1 s, 2 s, 4 s, 8 s, 16 s, puis 30 s maximum.
        delai = Math.min(1000 * 2 ** Math.min(suivi.echecs - 1, 5), 30000);
        Object.assign(connexions.get(url), {
          sante: "INDISPONIBLE", echecs: suivi.echecs,
          derniereVerification: new Date().toISOString(), erreur: error.message,
          prochainEssaiMs: delai,
        });
        console.log(`[exp_backoff] ${url} : échec ${suivi.echecs}, prochain essai dans ${delai / 1000}s`);
      }
      // Programmer après la réponse évite les vérifications simultanées.
      suivi.timer = setTimeout(verifier, delai);
      suivi.timer.unref();
    }

    suivi.timer = setTimeout(verifier, 0);
    suivi.timer.unref();
  }

  function etat(url, valeur) {
    connexions.set(url, { ...connexions.get(url), url, etat: valeur });
    console.log(`[${adresse}] ${url} : ${valeur}`);
    if (valeur === "ETABLI") surveiller(url);
  }

  async function envoyer(url, route, attente, suite) {
    const connexion = connexions.get(url);
    try {
      await axios.post(`${url}${route}`, {}, {
        headers: { Origin: adresse }, timeout: 5000, proxy: false,
      });
      // Un callback peut déjà avoir fait avancer l'état entre-temps.
      if (suite && connexions.get(url) === connexion && connexion?.etat === attente) etat(url, suite);
    } catch (error) {
      if (connexions.get(url) === connexion) etat(url, "ECHEC");
      console.error(`Échec ${route} :`, error.message);
    }
  }

  app.get("/connexions", (req, res) => res.json([...connexions.values()]));

  app.post("/handshake", (req, res) => {
    const cible = choisirCible(req, res);
    if (!cible) return;
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
