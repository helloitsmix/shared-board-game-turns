const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { IP, PORT } = require("./config"); // Importa la configurazione

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Mappa per tenere traccia degli utenti: deviceId => { username, ws, active, timeout }
const users = new Map();
const defaultRoom = "HEROQUEST";
// 30 minuti in millisecondi
const GRACE_PERIOD = 30 * 60 * 1000;

app.use(express.static('new_public'));

app.get("/config", (req, res) => {
  res.json({ IP, PORT });
});

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      if (data.type === 'login') {
        // Il client invia:
        // { type: 'login', username: 'Nome', deviceId: 'ID_univoco', admin: true/false, room: 'HEROQUEST' }
        ws.username = data.username;
        ws.deviceId = data.deviceId;
        ws.admin = data.admin;
        // Se l'utente esiste già (riconnessione) annulla il timer se presente
        if (users.has(data.deviceId)) {
          const existing = users.get(data.deviceId);
          if (existing.timeout) {
            clearTimeout(existing.timeout);
            existing.timeout = null;
          }
          existing.ws = ws;
          existing.active = true;
          existing.username = data.username; // Aggiorna il nome se è stato modificato
          existing.admin = data.admin;       // Aggiorna il flag admin
        } else {
          // Nuovo utente o utente che era stato rimosso definitivamente
          users.set(data.deviceId, {
            username: data.username,
            admin: data.admin,
            ws: ws,
            active: true,
            timeout: null
          });
        }
        broadcastUsersList();
      }
    } catch (err) {
      console.error("Errore nella gestione del messaggio:", err);
    }
  });

  ws.on('close', function () {
    if (ws.deviceId) {
      const user = users.get(ws.deviceId);
      if (user) {
        // Segna l'utente come inattivo e imposta un timer di 30 minuti per la rimozione definitiva
        user.active = false;
        user.timeout = setTimeout(() => {
          users.delete(ws.deviceId);
          broadcastUsersList();
        }, GRACE_PERIOD);
        broadcastUsersList();
      }
    }
  });
});

// Funzione per inviare la lista degli utenti attivi a tutti i client
function broadcastUsersList() {
  const activeUsers = [];
  for (let [deviceId, user] of users.entries()) {
    // Includiamo in lista solo gli utenti attivi (con ws aperto)
    // if (user.active && user.ws && user.ws.readyState === WebSocket.OPEN) {
    // let displayName = user.username;
    // if (user.admin) displayName += " (admin)";
    // if (!user.active) displayName += " (offline)";
    const { ws, timeout, ...rest } = user
    activeUsers.push({ deviceId, ...rest });
  }
  const message = JSON.stringify({
    type: 'update',
    connectedUsers: activeUsers,
    count: activeUsers.length
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.listen(PORT, IP, function () {
  console.log(`Server in ascolto su http://${IP}:${PORT}`);
});
