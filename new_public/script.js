let ws
let IP = '127.0.0.1'
let PORT = 3000
let ROOMS = ['Default']

// Recupera la configurazione prima di connettersi
fetch('/config')
  .then(response => response.json())
  .then(config => {
    IP = config.IP
    PORT = config.PORT
    ROOMS = config.ROOMS

    // Ottieni l'elemento <select>
    const select = document.getElementById('rooms')

    // Cicla l'array e aggiungi le opzioni al <select>
    ROOMS.forEach(room => {
      const option = document.createElement('option')
      option.value = room
      option.textContent = room
      select.appendChild(option)
    })

    const savedRoom = localStorage.getItem('room') || ROOMS[0]
    select.value = savedRoom
  })
  .catch(error => console.error('Errore nel caricamento della configurazione:', error))

// Recupera o genera un ID univoco per il dispositivo
let deviceId = localStorage.getItem('deviceId')
if (!deviceId) {
  deviceId = Date.now()
  localStorage.setItem('deviceId', deviceId)
}

const usernameInput = document.getElementById('username')
const adminCheckbox = document.getElementById('admin')
const roomInput = document.getElementById('rooms')
const savedUsername = localStorage.getItem('username')
const savedAdmin = localStorage.getItem('admin')

usernameInput.value = savedUsername || ''
adminCheckbox.checked = (savedAdmin === 'true')

document.getElementById('connect-btn').onclick = function () {
  const username = usernameInput.value.trim()
  const admin = adminCheckbox.checked
  const room = roomInput.value || ROOMS[0]
  if (!username) {
    alert('Inserisci un nome valido')
    return
  }
  localStorage.setItem('username', username)
  localStorage.setItem('admin', admin)
  localStorage.setItem('room', room)
  connect(username, admin, room)
}

function connect(username, admin, room) {
  ws = new WebSocket(`ws://${IP}:${PORT}`)

  ws.onopen = function () {
    // Invia il messaggio di login al server includendo il flag admin
    ws.send(JSON.stringify({
      type: 'login',
      deviceId,
      username,
      admin,
      room
    }))
    // ws.room = room
  }

  ws.onmessage = function (event) {
    const data = JSON.parse(event.data)
    console.log('data', data)

    if (data.type === 'login-successful') {
      textElement('.room-name', data.room)
      displayElement('#screen-0', 'none')
      displayElement('#screen-1')
      if (!data.admin) {
        displayElement('.admin-ui', 'none')
      }
    }
    
    if (data.type === 'update-room') {
      // {
      //   "type": "update",
      //   "connectedUsers": [
      //     {
      //       "deviceId": "1741627848664",
      //       "username": "Minchia",
      //       "admin": true,
      //       "active": true
      //     }
      //   ],
      //   "count": 1,
      //   "turnsGenerated": false
      // }
      textElement('#num-clients', data.count)
      const connectedPlayers = document.getElementById('connected-players')
      const list = data.connectedUsers.reduce((prev, u) => {
        return `${prev} <li>${u.username} (${!u.active ? 'offline' : 'online'}) ${u.admin ? '(admin)' : ''}</li>`
      }, '')
      connectedPlayers.innerHTML = `<ul>${list}</ul>`
    }

    if (data.type === 'turn-update') {
      displayElement('#screen-1', 'none')
      displayElement('#screen-2')
      // Aggiorna la visualizzazione della lista dei turni
      let html = ''
      data.turnOrder.forEach((user, index) => {
        if (index === data.currentTurnIndex) {
          html += `<div style='font-weight: bold'>${user.username}</div>`
        } else {
          html += `<div>${user.username}</div>`
        }
      })
      document.getElementById('turn-list').innerHTML = html

      // Gestione visibilità dei pulsanti in base al ruolo e al turno corrente
      if (admin) {
        // Gli admin vedono sempre tutti i tasti di controllo
        document.getElementById('generate-turn').style.display = 'inline-block'
        document.getElementById('finish-turn').style.display = 'inline-block'
        document.getElementById('prev-turn').style.display = 'inline-block'
      } else {
        // I non-admin vedono 'Finisci turno' solo se è il loro turno
        if (data.turnOrder[data.currentTurnIndex] && data.turnOrder[data.currentTurnIndex].deviceId === deviceId) {
          document.getElementById('finish-turn').style.display = 'inline-block'
        } else {
          document.getElementById('finish-turn').style.display = 'none'
        }
        document.getElementById('generate-turn').style.display = 'none'
        document.getElementById('prev-turn').style.display = 'none'
      }
    }
  }

  ws.onclose = function () {
    // In caso di disconnessione, tentiamo di riconnetterci dopo qualche secondo
    setTimeout(() => {
      console.log('Tentativo di riconnessione...')
      connect(username, admin, room)
    }, 3000)
  }

  ws.onerror = function (error) {
    console.error('WebSocket error:', error)
    document.querySelector('#error').textContent = `${error}`
  }
}

// Event listener per i pulsanti dei turni
document.getElementById('generate-turn').onclick = function () {
  ws.send(JSON.stringify({ type: 'generate-turn' }))
}

document.getElementById('finish-turn').onclick = function () {
  ws.send(JSON.stringify({ type: 'finish-turn' }))
}

document.getElementById('prev-turn').onclick = function () {
  ws.send(JSON.stringify({ type: 'prev-turn' }))
}

const textElement = (el = '', text = '') => {
  let elements = document.querySelectorAll(el) || []
  elements.forEach(elem => elem.textContent = text)
}

const displayElement = (el = '', display = 'block') => {
  let elements = document.querySelectorAll(el) || []
  elements.forEach(elem => elem.style.display = display)
}