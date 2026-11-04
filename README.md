# Comprendre HTTP et WebSocket

Ce projet permet de voir comment deux clients communiquent avec un serveur et comment deux API échangent des messages.

## Notre parcours depuis le début

Nous avons construit le projet progressivement :

1. Créer un serveur Express et une route HTTP `/users` sur le port 3000.
2. Appeler cette route depuis un programme Node.js avec Axios.
3. Ajouter un serveur WebSocket au même serveur HTTP.
4. Connecter un premier client, envoyer un message et recevoir une réponse.
5. Ajouter un deuxième client pour observer plusieurs connexions simultanées.
6. Remplacer la réponse individuelle par un broadcast : le message reçu est envoyé à tous les clients connectés.
7. Gérer les déconnexions et prévenir les clients restants.
8. Ajouter une deuxième API sur 3001 pour simuler SYN / SYN-ACK / ACK avec des objets JSON.

Nous restons sur cette simulation JSON pour apprendre. Les deux expériences sont indépendantes : les clients utilisent WebSocket sur 3000 ; la simulation fait communiquer API 1 et API 2 en HTTP.

```text
Client 1 ── HTTP /users et WebSocket ── API 1 :3000
Client 2 ───────── WebSocket ────────── API 1 :3000
PowerShell ── POST /handshake ───────── API 1 :3000 ── HTTP/JSON ── API 2 :3001
```

## 1. Qui fait quoi ?

| Fichier | Rôle |
| --- | --- |
| `server1.js` | API 1 sur le port **3000** : routes HTTP et serveur WebSocket |
| `server2.js` | API 2 sur le port **3001** : simulation SYN / SYN-ACK / ACK |
| `client1.js` | Appelle `/users` avec Axios puis se connecte en WebSocket à API 1 |
| `client2.js` | Se connecte en WebSocket à API 1 |
| `.gitignore` | Demande à Git d'ignorer `node_modules/` |

`localhost` désigne ton ordinateur. Le port permet de choisir le serveur auquel tu parles : ici 3000 ou 3001.

Un serveur attend des connexions. Un client démarre une communication. API 1 joue aussi le rôle de client lorsqu'elle appelle API 2 avec Axios.

## 2. Lancer le projet

Dans le dossier du projet, installer les dépendances :

Il faut avoir Node.js et npm installés. Vérifier avec `node --version` et `npm --version`. Toutes les commandes suivantes s'exécutent dans le dossier contenant `package.json`.

```bash
npm install
```

Cette commande lit `package.json` et installe les bibliothèques dans `node_modules/`. Ce dossier est ignoré par Git car il peut être recréé avec `npm install`. `package-lock.json` conserve les versions précises des dépendances.

Express gère les routes HTTP, Axios envoie les requêtes HTTP, `ws` gère WebSocket et nodemon redémarre le serveur pendant le développement. `cors` configure les permissions d'accès entre origines pour les navigateurs ; ce n'est pas lui qui crée les connexions WebSocket.

Ouvrir trois terminaux dans ce dossier et lancer, dans cet ordre :

```bash
# Terminal 1 : serveur principal
npm run api1
```

```bash
# Terminal 2 : premier client
npm run client1
```

```bash
# Terminal 3 : deuxième client
npm run client2
```

`npm start` lance aussi API 1 : choisir une seule des deux commandes pour éviter d'utiliser deux fois le port 3000.

Le premier client affiche les utilisateurs reçus par HTTP et les messages WebSocket. Quand le deuxième arrive, il envoie son message : les deux clients le reçoivent.

Les messages ne sont pas stockés : un client qui arrive plus tard ne reçoit pas les anciens messages.

## 3. HTTP et Axios : une question, une réponse

Axios est une bibliothèque qui permet d'envoyer des requêtes HTTP.

Dans `client1.js` :

```js
const response = await axios.get("http://localhost:3000/users");
console.log(response.data);
```

1. Le client demande la liste des utilisateurs.
2. Express trouve la route `app.get("/users", ...)` dans `server1.js`.
3. Le serveur répond avec un tableau JSON.
4. Axios rend ce résultat disponible dans `response.data`.

`await` attend le résultat avant de poursuivre cette fonction. `try/catch` permet de gérer un échec, par exemple si le serveur est arrêté.

Une requête HTTP reçoit une réponse. Pour récupérer de nouvelles données avec ce modèle, le client doit faire une nouvelle requête.

## 4. Le cycle de vie WebSocket

Imagine un appel téléphonique : une fois la communication ouverte, chacun peut parler sans rappeler à chaque phrase.

### Étape 1 : le handshake HTTP

```js
const ws = new WebSocket("ws://localhost:3000");
```

Dans ce projet, la bibliothèque commence par une requête HTTP demandant de passer au protocole WebSocket avec `Upgrade: websocket`. Le serveur accepte avec une réponse HTTP `101 Switching Protocols`.

La bibliothèque `ws` gère cet échange automatiquement.

### Étape 2 : la connexion est établie

Côté client, `ws.on("open", ...)` se déclenche quand la connexion est prête.

Côté serveur, `wss.on("connection", (ws) => ...)` se déclenche pour chaque nouveau client.

- `wss` représente le serveur WebSocket et l'ensemble de ses connexions.
- `ws` représente une connexion avec un client précis.
- `on(...)` enregistre une fonction qui sera appelée quand l'événement arrive.

HTTP et WebSocket utilisent ici le même serveur et le même port 3000, grâce à `new WebSocketServer({ server })`.

### Étape 3 : le client envoie un message

```js
ws.on("open", () => {
  ws.send("Bonjour serveur !");
});
```

On attend `open` avant d'envoyer : la connexion doit être prête.

### Étape 4 : le serveur reçoit et peut répondre

```js
ws.on("message", (message) => {
  console.log(message.toString());
});
```

Avec la bibliothèque `ws` utilisée ici, `toString()` permet de lire le message texte reçu.

Le serveur peut utiliser `ws.send(...)` à tout moment tant que la connexion est ouverte. Il envoie déjà un message de bienvenue lors de la connexion. Le client reçoit aussi avec `ws.on("message", ...)`.

Les deux côtés peuvent donc envoyer et recevoir : c'est une communication **bidirectionnelle**.

### Étape 5 : la déconnexion

`ws.on("close", ...)` se déclenche quand la connexion se termine. Dans notre serveur :

1. On affiche l'identifiant du client, le code de fermeture et la raison disponible.
2. La bibliothèque retire automatiquement la connexion de `wss.clients`.
3. On prévient les clients restants et on affiche leur nombre.

`ws.on("error", ...)` sert à afficher les erreurs. Un arrêt brutal peut produire le code `1006`, qui signale une fermeture anormale. Une perte réseau peut prendre du temps à être détectée.

## 5. Le broadcast : envoyer à tout le monde

Dans `server1.js`, la fonction `broadcast` parcourt les connexions :

```js
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
```

`wss.clients` contient les clients connectés. `WebSocket.OPEN` permet de vérifier qu'une connexion accepte encore des messages.

Quand le serveur reçoit un message, il appelle `broadcast(message.toString())`. Tous les clients présents le reçoivent, **y compris celui qui l'a envoyé**.

```text
Client 2 → Serveur → Client 1
                  → Client 2
```

Les clients ne communiquent pas directement entre eux : le serveur transmet leurs messages.

## 6. TCP et SYN / SYN-ACK / ACK

Il faut distinguer trois échanges :

| Échange | Son rôle | Qui le gère ici ? |
| --- | --- | --- |
| Handshake TCP | Établir la connexion de transport | Le système d'exploitation |
| Handshake WebSocket | Passer de HTTP à WebSocket | La bibliothèque `ws` |
| Simulation JSON SYN / SYN-ACK / ACK | Illustrer trois étapes entre nos API | Notre code Express et Axios |

Pour nos connexions locales, TCP s'établit avant l'échange HTTP, puis le handshake WebSocket permet de garder un canal WebSocket ouvert.

Le véritable handshake TCP utilise des drapeaux et des numéros de séquence dans des paquets TCP :

```text
Client                        Serveur
   ───── SYN ──────────────────→  Demande de connexion
   ←──── SYN-ACK ────────────────  Demande reçue et confirmée
   ───── ACK ──────────────────→  Confirmation reçue
```

Dans notre simulation, les mots `SYN`, `SYN-ACK` et `ACK` sont simplement des valeurs JSON envoyées via HTTP. Ce ne sont pas de vrais paquets TCP.

### Tester la simulation entre API 1 et API 2

Garder API 1 démarrée, puis ouvrir un autre terminal :

```bash
npm run api2
```

Dans un terminal PowerShell, déclencher la simulation :

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/handshake
```

Voici le chemin suivi :

1. PowerShell appelle `POST /handshake` sur API 1.
2. API 1 envoie `{ type: "SYN" }` à `POST /syn` sur API 2.
3. API 2 répond `{ type: "SYN-ACK", sessionId: "..." }`.
4. API 1 envoie `{ type: "ACK", sessionId: "..." }` à `POST /ack` sur API 2.
5. API 2 vérifie l'identifiant et répond avec `status: "ESTABLISHED"`.
6. API 1 retourne le résultat à PowerShell.

Le `sessionId` relie l'ACK au SYN précédent. API 2 attend cet ACK pendant 10 secondes. Un ACK inconnu, expiré ou déjà utilisé est refusé.

### Observer l'échange dans les terminaux

Pour cette expérience seule, trois terminaux suffisent : API 1, API 2 et PowerShell pour la commande. Les deux scripts clients ne sont pas nécessaires.

Dans le terminal API 1 :

```text
[1] API 1 → API 2 : SYN
[2] API 2 → API 1 : SYN-ACK
[3] API 1 → API 2 : ACK
```

Dans le terminal API 2 :

```text
[1] SYN reçu de API 1
[2] SYN-ACK envoyé à API 1, en attente de ACK
[3] ACK reçu : échange établi !
```

Dans PowerShell, le résultat ressemble à ceci :

```text
steps               sessionId                            status
-----               ---------                            ------
{SYN, SYN-ACK, ACK} b7af7869-8262-4c69-9d31-2a3b8e6020df ESTABLISHED
```

L'identifiant change à chaque essai. `steps` décrit les étapes effectuées ; `status` indique que notre simulation a réussi. Les journaux montrent les étapes du programme, pas une capture de paquets réseau.

Pour afficher la réponse sous forme JSON :

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/handshake | ConvertTo-Json
```

La route expérimentale `/tcp` et le fichier `TCP-REEL.md` concernent l'observation du vrai TCP. Ils ne sont pas nécessaires pour notre parcours JSON.

`ESTABLISHED` est ici le résultat de notre simulation. Cette route ne crée pas de connexion WebSocket. Les clients WebSocket continuent à utiliser API 1 sur 3000 ; API 2 sert uniquement à cette expérience.

## 7. Les exercices pour comprendre

| Exercice | Ce que tu apprends | État du projet |
| --- | --- | --- |
| 1. Connecter deux clients | Plusieurs connexions simultanées | Réalisé avec les deux scripts clients |
| 2. Envoyer un message | Communication bidirectionnelle | Réalisé : message du client et bienvenue du serveur |
| 3. Diffuser un message | Broadcast à tous les clients | Réalisé avec `broadcast()` |
| 4. Créer un chat | Envoyer plusieurs messages en temps réel | Base présente ; saisie interactive à ajouter |
| 5. Gérer les déconnexions | Cycle de vie des connexions | Réalisé : événement `close` et notification |
| 6. Envoyer du JSON | Échanger des objets structurés | Utilisé entre les API ; à pratiquer en WebSocket |

### Expérience A : observer deux clients

Lance API 1, puis client 1, puis client 2. Observe que le message du client 2 apparaît dans les deux terminaux. Le message initial du client 1 est parti avant l'arrivée du client 2 : celui-ci ne le reçoit pas.

### Expérience B : observer une déconnexion

Ferme le client 2 avec `Ctrl+C`. Observe le journal du serveur et la notification reçue par le client 1. Les identifiants sont attribués par ordre de connexion : ils ne sont pas liés au nom des fichiers.

### Expérience C : changer le message

Modifie le texte dans `ws.send(...)` de `client2.js`, puis relance ce client. Le nouveau texte doit apparaître chez les clients connectés.

### Expérience D : préparer le chat

Actuellement, chaque client envoie une seule phrase automatiquement. Pour créer un chat interactif, la prochaine étape consiste à lire ce que tu tapes dans le terminal avec `readline`, puis à appeler `ws.send(texte)` pour chaque ligne.

### Expérience E : envoyer un objet JSON en WebSocket

Exemple à essayer dans le gestionnaire `open` d'un client :

```js
ws.send(JSON.stringify({
  type: "chat",
  auteur: "Ibrahim",
  texte: "Salut !",
}));
```

`JSON.stringify()` transforme l'objet JavaScript en texte à envoyer. Le serveur actuel diffuse ce texte tel quel.

Pour récupérer un objet à la réception, on peut utiliser :

```js
ws.on("message", (message) => {
  const texte = message.toString();
  try {
    const objet = JSON.parse(texte);
    console.log(objet.auteur, objet.texte);
  } catch {
    console.log(texte);
  }
});
```

Le `try/catch` est nécessaire ici car le serveur envoie aussi du texte simple : bienvenue et notifications de déconnexion. À terme, on pourra définir un format JSON commun pour tous les messages.

## 8. Axios vs WebSocket

| Axios | WebSocket |
| --- | --- |
| Bibliothèque pour faire des requêtes HTTP | Protocole utilisé ici via la bibliothèque `ws` |
| Le client fait une requête, le serveur répond | Les deux côtés peuvent envoyer à tout moment |
| Chaque échange suit le modèle requête/réponse | Le canal reste ouvert pour plusieurs messages |
| Adapté au CRUD : créer, lire, modifier, supprimer | Adapté au chat, aux notifications et au temps réel |
| `axios.get(...)`, `axios.post(...)` | `ws.send(...)`, `ws.on("message", ...)` |

Une connexion réseau HTTP peut être réutilisée pour plusieurs requêtes grâce au keep-alive : HTTP ne signifie donc pas forcément « nouvelle connexion puis fermeture à chaque requête ». La différence à retenir ici est la façon d'échanger les messages.

Les deux approches peuvent fonctionner ensemble : charger l'historique d'un chat avec Axios, puis recevoir les nouveaux messages avec WebSocket.

