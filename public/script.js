let ws
let IP = '127.0.0.1'
let PORT = 3000
let ROOMS = ['Default']
let DEFAULT_COLOR = '#FFDC95'
let USE_COLORS = false
let COLORS = []
const WS_CLOSE_LOGOUT_CODE = 4001

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
const addClass = (selector, className) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.classList.add(className))
}
const removeClass = (selector, className) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.classList.remove(className))
}
const setOnClick = (selector, fn = () => { }) => {
  let elements = document.querySelectorAll(selector) || []
  elements.forEach(elem => elem.onclick = fn)
}
const openModal = (message) => {
  removeProperty('[data-ui-type="modal"]', 'display', 'none')
  setTextContent('[data-render="modal-message"]', message)
}
const renderUsersList = (selector, users, currentIndex) => {
  const renderContainer = document.querySelector(selector)
  const list = users.map((user, index) => {
    const userColor = (USE_COLORS && user.color) ? `<span class="user-color" style="background-color: ${user.color}"></span>` : ''
    const highlightColor = (USE_COLORS && user.color) ? `${user.color}26` : `${DEFAULT_COLOR}`
    const highlight = index === currentIndex ? `style="background-color: ${highlightColor}"` : ''

    return (`
      <li ${highlight}>
        <span class="position">${index + 1}</span>
        ${userColor}
        <span class="username">${user.username}</span>
        <span class="icons-container">
          ${user.admin ? '<i class="fa-solid fa-crown admin-icon"></i>' : ''}
          <i class="fa-solid fa-wifi ${user.active ? 'status-online-icon' : 'status-offline-icon'}"></i>
        </span>
      </li>
    `)
  })
  renderContainer.innerHTML = list.join('')
}

// Fetch the configuration (IP, PORT, ROOMS)
fetch('/config')
  .then(response => response.json())
  .then(config => {
    IP = config.IP
    PORT = config.PORT
    ROOMS = config.ROOMS
    DEFAULT_COLOR = config.DEFAULT_COLOR
    USE_COLORS = config.USE_COLORS
    COLORS = config.COLORS

    const select = document.getElementById('rooms-input')
    ROOMS.forEach(room => {
      const option = document.createElement('option')
      option.value = room
      option.textContent = room
      select.appendChild(option)
    })

    const savedRoom = localStorage.getItem('room') || ROOMS[0]
    select.value = savedRoom

    if (USE_COLORS) {
      let savedColor = localStorage.getItem('color')
      if (!savedColor || !COLORS.includes(savedColor)) {
        savedColor = COLORS[0]
      }

      // show color picker
      removeProperty('[data-ui-type="color-picker"]', 'display', 'none')
      
      // set saved color
      const colorInput = document.getElementById('color-input')
      colorInput.dataset.color = savedColor

      // render colors
      COLORS.forEach(color => {
        const colorBtn = document.createElement('button')
        colorBtn.classList.add('color-option')
        colorBtn.classList.toggle('selected', color === savedColor)
        colorBtn.style.backgroundColor = color
        colorBtn.dataset.color = color
        colorBtn.addEventListener('click', () => {
          removeClass('.color-option', 'selected')
          colorBtn.classList.add('selected')
          colorInput.dataset.color = color
        })
        colorInput.appendChild(colorBtn)
      })
      
    }
  })
  .catch(error => openModal(`Unable to fetch the configuration: ${error}`))

// Get the device ID or generate a new one
let deviceId = localStorage.getItem('deviceId')
if (!deviceId) {
  deviceId = Date.now().toString(36) + Math.random().toString(36).substring(2)
  localStorage.setItem('deviceId', deviceId)
}

// Get elements from the DOM
const usernameInput = document.getElementById('username')
const adminCheckbox = document.getElementById('admin')
const roomInput = document.getElementById('rooms-input')
const colorInput = document.getElementById('color-input')
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
  const color = colorInput.dataset.color
  if (!username) {
    alert('Enter a valid name')
    return
  }
  localStorage.setItem('username', username)
  localStorage.setItem('admin', admin)
  localStorage.setItem('room', room)
  localStorage.setItem('color', color)
  connect(username, admin, room, color)
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
setOnClick('[data-btn-action="exit-turns"]', () => {
  ws.send(JSON.stringify({ type: 'logout' }))
  // ws.close()
})
setOnClick('[data-btn-action="close-modal"]', () => {
  setProperty('[data-ui-type="modal"]', 'display', 'none')
  setTextContent('[data-render="modal-message"]', '')
})

function connect(_username, _admin, _room, _color) {
  ws = new WebSocket(`ws://${IP}:${PORT}`)

  ws.onopen = function () {
    // # Login
    ws.send(JSON.stringify({
      type: 'login',
      deviceId,
      username: _username,
      admin: _admin,
      room: _room,
      color: _color
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
      renderUsersList('[data-render="room-connected-users"]', connectedUsers)
      
      setProperty('[data-screen-name="login"]', 'display', 'none')
      removeProperty('[data-screen-name="room"]', 'display', 'none')
      setProperty('[data-screen-name="turns"]', 'display', 'none')
    }

    // # Turn update
    if (MSG_TYPE === 'turn-update') {
      const { turnOrder, currentTurnIndex } = data
      const userTurn = turnOrder[currentTurnIndex]
      setProperty('[data-screen-name="room"]', 'display', 'none')
      removeProperty('[data-screen-name="turns"]', 'display', 'none')
      renderUsersList('[data-render="room-turns-list"]', turnOrder, currentTurnIndex)

      if (!userTurn) {
        // If no turn prompt to regenerate turns
        setProperty('[data-btn-action="finish-turn"]', 'display', 'none')
        setProperty('[data-btn-action="generate-turn"][data-btn-type="icon-only"]', 'flex', '1')
        addClass('[data-btn-action="generate-turn"][data-btn-type="icon-only"]', 'highlight')
      } else {
        removeProperty('[data-btn-action="generate-turn"][data-btn-type="icon-only"]', 'flex', '1')
        removeClass('[data-btn-action="generate-turn"][data-btn-type="icon-only"]', 'highlight')
        // If it's your turn or you're an admin, show the "Finish turn" button
        if (_admin || userTurn.deviceId === deviceId) {
          removeProperty('[data-btn-action="finish-turn"]', 'display', 'none')
        } else {
          setProperty('[data-btn-action="finish-turn"]', 'display', 'none')
        }
      }
    }

    // # User logout (login redirect)
    if (MSG_TYPE === 'logout-successful') {
      setProperty('[data-screen-name="room"]', 'display', 'none')
      setProperty('[data-screen-name="turns"]', 'display', 'none')
      removeProperty('[data-screen-name="login"]', 'display', 'none')
    }
  }

  // # Websocket close
  ws.onclose = function (e) {
    // Logout from the server
    if (e.code === WS_CLOSE_LOGOUT_CODE) {
      console.log('Logout successful')
      return
    } else {
      // Show a modal with the reason of the disconnection and attempt to reconnect
      openModal(`Connection lost, the system will attempt to reconnect in 3 seconds. (code: ${e.code}, reason: ${e.reason})`)
      setTimeout(() => {
        connect(_username, _admin, _room, _color)
      }, 3000)
    }
  }

  // # Error handling
  ws.onerror = function (error) {
    console.log('WebSocket error:', error)
    let message = typeof error === 'object' ? JSON.stringify(error) : error
    openModal(`WebSocket error: ${message}`)
  }
}