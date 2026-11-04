# Healthcheck et exp_backoff

Le handshake valide notre échange initial. Ensuite, on veut savoir si l'API du camarade répond encore.

## Healthcheck

Chaque API expose `GET /health` et répond 200 avec :

```json
{ "status": "ok", "origin": "http://172.20.10.2:3000", "uptime": 123 }
```

`uptime` est le temps de fonctionnement du processus en secondes. Ce test vérifie que notre serveur HTTP répond ; il ne vérifie pas une base de données ou tous les services de la machine.

Après un handshake arrivé à `ETABLI`, notre API vérifie automatiquement `/health` du camarade toutes les 5 secondes. Un appel peut attendre au maximum 3 secondes.

## Exp_backoff

Si le serveur ne répond plus, on espace les vérifications pour ne pas envoyer des requêtes en boucle :

| Échecs consécutifs | Attente avant la prochaine vérification |
| --- | --- |
| 1 | 1 seconde |
| 2 | 2 secondes |
| 3 | 4 secondes |
| 4 | 8 secondes |
| 5 | 16 secondes |
| 6 et plus | 30 secondes |

Le délai commence après la fin de chaque tentative. Dès qu'une réponse valide revient, le compteur repasse à zéro et on reprend les vérifications toutes les 5 secondes.

Ce mécanisme répète uniquement le healthcheck. Il ne renvoie pas automatiquement les messages SYN/SYN-ACK/ACK, pour lesquels des doublons demanderaient une gestion spécifique.

## Tester

1. Les deux camarades ajoutent `GET /health` avec une réponse JSON contenant `status: "ok"` et redémarrent leurs API.
2. Lancer le handshake habituel :

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/handshake
```

3. Consulter l'état :

```powershell
Invoke-RestMethod http://localhost:3000/connexions | ConvertTo-Json
```

4. Arrêter l'API du camarade : les journaux affichent `[exp_backoff]`, et `sante` devient `INDISPONIBLE`.
5. Relancer son API : une prochaine vérification détecte son retour et `sante` redevient `DISPONIBLE`.

On peut aussi appeler directement notre healthcheck :

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Dans `/connexions`, `etat` représente l'étape du handshake ; `sante` indique le résultat du dernier healthcheck. Un ancien état `ETABLI` ne prouve donc pas que le camarade est actuellement disponible. Un retour du healthcheck ne relance pas le handshake.
