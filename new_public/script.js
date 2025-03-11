// const id = uuidv4()
// const dungeonNames = ['dungeon master', 'dungeonmaster', 'dungeon', 'master', 'dm', 'diego']

let IP = '127.0.0.1';
let PORT = 3000;

// Recupera la configurazione prima di connettersi
fetch("/config")
  .then(response => response.json())
  .then(config => {
    IP = config.IP
    PORT = config.PORT
  })
  .catch(error => console.error("Errore nel caricamento della configurazione:", error));

let ws;
// Recupera o genera un ID univoco per il dispositivo
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = Date.now();
  localStorage.setItem('deviceId', deviceId);
}

// Se esiste un nome salvato, pre-popoliamo l'input
const savedUsername = localStorage.getItem('username');
if (savedUsername) {
  document.getElementById('username').value = savedUsername;
}
// Pre-popoliamo lo stato del checkbox admin in base a quanto salvato in localStorage
const savedAdmin = localStorage.getItem('admin');
document.getElementById('admin').checked = (savedAdmin === 'true');

document.getElementById('connect-btn').onclick = function () {
  const username = document.getElementById('username').value.trim();
  const admin = document.getElementById('admin').checked;
  if (!username) {
    alert('Inserisci un nome');
    return;
  }
  // Salva l'username e lo stato admin in localStorage per future connessioni
  localStorage.setItem('username', username);
  localStorage.setItem('admin', admin);
  connect(username, admin);
};

function connect(username, admin) {
  ws = new WebSocket(`ws://${IP}:${PORT}`);

  ws.onopen = function () {
    // Invia il messaggio di login al server includendo il flag admin
    ws.send(JSON.stringify({
      type: 'login',
      username: username,
      deviceId: deviceId,
      admin: admin,
      room: 'HEROQUEST'
    }));
    // Nascondi dati input una volta connessi
    hideByClass('login-ui')
  };

  ws.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log('data', data)
    if (data.type === 'update') {
      document.getElementById('num-clients').textContent = data.count
      document.getElementById('users').innerHTML =
        'Utenti connessi (' + data.count + '): ' + data.connectedUsers.map(u => u.username).join(', ');
    }
  };

  ws.onclose = function () {
    // In caso di disconnessione, tentiamo di riconnetterci dopo qualche secondo
    setTimeout(() => {
      console.log("Tentativo di riconnessione...");
      connect(username, admin);
      // Mostro dati input se disconnesso
      showByClass('login-ui')
    }, 3000);
  };

  ws.onerror = function (error) {
    console.error('WebSocket error:', error);
  };
}

function hideByClass (className) {
  let elements = document.getElementsByClassName(className) ?? []
  for (const element of elements) {
    element.style.display = 'none'
  }
}

function showByClass (className) {
  let elements = document.getElementsByClassName(className) ?? []
  for (const element of elements) {
    element.style.display = 'block'
  }
}