let ws
let IP = '127.0.0.1'
let PORT = 3000
let ROOMS = ['Default']

// Utility functions
const setTextContent = (selector, text = '') => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.textContent = text)
}
const setProperty = (selector, propertyName, value) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.style.setProperty(propertyName, value))
}
const removeProperty = (selector, propertyName, value) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.style.removeProperty(propertyName, value))
}
const setOnClick = (selector, fn = () => { }) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.onclick = fn)
}
const renderRoom = (selector, users) => {
  const renderContainer = document.querySelector(selector)
  const list = users.reduce((prev, u) => {
    return `${prev} <li>${u.username} (${!u.active ? 'offline' : 'online'}) ${u.admin ? '(admin)' : ''}</li>`
  }, '')
  renderContainer.innerHTML = `<ul>${list}</ul>`
}

// Fetch the configuration (IP, PORT, ROOMS)
fetch('/config')
  .then(response => response.json())
  .then(config => {
    IP = config.IP
    PORT = config.PORT
    ROOMS = config.ROOMS

    const select = document.getElementById('rooms-input')
    ROOMS.forEach(room => {
      const option = document.createElement('option')
      option.value = room
      option.textContent = room
      select.appendChild(option)
    })

    const savedRoom = localStorage.getItem('room') || ROOMS[0]
    select.value = savedRoom
  })
  .catch(error => console.log('Errore nel caricamento della configurazione:', error))

// Get the device ID or generate a new one
let deviceId = localStorage.getItem('deviceId')
if (!deviceId) {
  deviceId = Date.now()
  localStorage.setItem('deviceId', deviceId)
}

// Get elements from the DOM
const usernameInput = document.getElementById('username')
const adminCheckbox = document.getElementById('admin')
const roomInput = document.getElementById('rooms-input')
const savedUsername = localStorage.getItem('username')
const savedAdmin = localStorage.getItem('admin')

// Populate the form with saved values
usernameInput.value = savedUsername || ''
adminCheckbox.checked = (savedAdmin === 'true')

// Buttons event listeners
setOnClick('[data-btn-action="login"]', () => {
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
})
setOnClick('[data-btn-action="generate-turn"]', () => {
  ws.send(JSON.stringify({ type: 'generate-turn' }))
})
setOnClick('[data-btn-action="finish-turn"]', () => {
  ws.send(JSON.stringify({ type: 'finish-turn' }))
})
setOnClick('[data-btn-action="prev-turn"]', () => {
  ws.send(JSON.stringify({ type: 'prev-turn' }))
})

function connect(_username, _admin, _room) {
  ws = new WebSocket(`ws://${IP}:${PORT}`)

  ws.onopen = function () {
    // # Login
    ws.send(JSON.stringify({
      type: 'login',
      deviceId,
      username: _username,
      admin: _admin,
      room: _room
    }))
  }

  ws.onmessage = function (event) {

    // # Parse the incoming message
    const parsed = JSON.parse(event.data)
    const {
      type: MSG_TYPE,
      ...data
    } = parsed
    console.log('Incoming message from server:', parsed)

    // # Login successful
    if (MSG_TYPE === 'login-successful') {
      const { room, admin } = data
      setTextContent('[data-render="room-name"]', room)
      setProperty('[data-screen-name="login"]', 'display', 'none')
      removeProperty('[data-screen-name="room"]', 'display', 'none')
      if (!admin) {
        setProperty('[data-ui-type="admin"]', 'display', 'none')
      }
    }

    // # Room update
    if (MSG_TYPE === 'room-update') {
      const { count, connectedUsers } = data
      setTextContent('[data-render="room-users-count"]', count)
      renderRoom('[data-render="room-connected-users"]', connectedUsers)
    }

    // # Turn update
    if (MSG_TYPE === 'turn-update') {
      const { turnOrder, currentTurnIndex } = data
      const userTurn = turnOrder[currentTurnIndex] ?? {}
      setProperty('[data-screen-name="room"]', 'display', 'none')
      removeProperty('[data-screen-name="turns"]', 'display', 'none')
      // Aggiorna la visualizzazione della lista dei turni
      let html = ''
      turnOrder.forEach((user, index) => {
        if (index === currentTurnIndex) {
          html += `<div style='font-weight: bold'>${user.username}</div>`
        } else {
          html += `<div>${user.username}</div>`
        }
      })
      document.querySelector('[data-render="room-connected-users-turns-list"]').innerHTML = html

      // If it's your turn or you're an admin, show the "Finish turn" button
      if (_admin || userTurn.deviceId === deviceId) {
        removeProperty('[data-btn-action="finish-turn"]', 'display', 'none')
      } else {
        setProperty('[data-btn-action="finish-turn"]', 'display', 'none')
      }
    }
  }

  // # Reconnection attempt
  ws.onclose = function () {
    // In caso di disconnessione, tentiamo di riconnetterci dopo qualche secondo
    setTimeout(() => {
      console.log('Tentativo di riconnessione...')
      connect(_username, _admin, _room)
    }, 3000)
  }

  // # Error handling
  ws.onerror = function (error) {
    console.log('WebSocket error:', error)
    setTextContent('#error', typeof error === 'object' ? JSON.parse(error) : error)
  }
}