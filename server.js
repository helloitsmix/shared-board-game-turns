const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const CONFIG = require('./config') // Import the configuration

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })
const WS_CLOSE_LOGOUT_CODE = 4001

// Users and rooms maps
const users = new Map()
const rooms = new Map()

const getUser = (deviceId = '') => {
  if (users.has(deviceId)) {
    return users.get(deviceId)
  }
  return undefined
}

const getRoomState = (room = '') => {
  if (!rooms.has(room)) {
    rooms.set(room, {
      turnOrder: [],
      currentTurnIndex: 0,
      turnsGenerated: false
    })
  }
  return rooms.get(room)
}

app.use(express.static('public'))

app.get('/config', (req, res) => {
  res.json(CONFIG)
})

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message)
      console.log('Incoming message:', data)

      // # Login user into a room
      if (data.type === 'login') {
        ws.deviceId = data.deviceId

        // Update or add the user to the users map
        // clear the user timeout if the user is back before the grace period
        const existing = getUser(data.deviceId)
        if (existing) {
          if (existing.timeout) {
            clearTimeout(existing.timeout)
            existing.timeout = null
          }
          existing.username = data.username
          existing.admin = data.admin
          existing.room = data.room
          existing.color = data.color
          existing.active = true
          existing.ws = ws
        } else {
          users.set(data.deviceId, {
            username: data.username,
            admin: data.admin,
            room: data.room,
            color: data.color,
            active: true,
            ws: ws,
            timeout: null
          })
        }

        // broadcast user login success
        broadcastLoginSuccessful(data.deviceId)
        // broadcast the room the user joined
        broadcastUpdateRoom(data.room)
        // broadcast the turn order if turns are already generated
        let roomState = getRoomState(data.room)
        if (roomState.turnsGenerated) {
          if (!roomState.turnOrder.includes(data.deviceId)) {
            roomState.turnOrder.push(data.deviceId)
          }
          broadcastTurnOrder(data.room)
        }
      }

      // # Generate turns order
      if (data.type === 'generate-turn') {
        const user = getUser(ws.deviceId) ?? {}
        if (!user.admin) return
        const room = user.room
        const roomState = getRoomState(room)
        const roomUsers = []
        users.forEach((u, deviceId) => {
          if (u.room === room) {
            roomUsers.push(deviceId)
          }
        })
        roomState.turnsGenerated = true
        roomState.currentTurnIndex = 0
        roomState.turnOrder = shuffle(roomUsers)
        broadcastTurnOrder(room)
      }

      // # Go to the next turn
      if (data.type === 'finish-turn') {
        const user = getUser(ws.deviceId) ?? {}
        const room = user.room
        const roomState = getRoomState(room)
        // Only the admin or the user playing can finish the turn
        if (!user.admin && roomState.turnOrder[roomState.currentTurnIndex] !== ws.deviceId) return
        if (roomState.currentTurnIndex < roomState.turnOrder.length) {
          roomState.currentTurnIndex++
        }
        broadcastTurnOrder(room)
      }

      // # Go back to the previous turn
      if (data.type === 'prev-turn') {
        const user = getUser(ws.deviceId) ?? {}
        if (!user.admin) return
        const room = user.room
        const roomState = getRoomState(room)
        if (roomState.currentTurnIndex > 0) {
          roomState.currentTurnIndex--
        }
        broadcastTurnOrder(room)
      }

      // # Logout user from the room
      if (data.type === 'logout') {
        broadcastLogoutSuccessful(ws.deviceId)
        ws.close(WS_CLOSE_LOGOUT_CODE, 'User logout')
      }

    } catch (err) {
      console.error('Errore nella gestione del messaggio:', err)
    }
  })

  ws.on('close', function () {
    const user = getUser(ws.deviceId)
    if (user) {
      const roomState = getRoomState(user.room)

      // Broadcast change of "active" status in either room or turn order
      user.active = false
      if (roomState.turnsGenerated) {
        broadcastTurnOrder(user.room)
      } else {
        broadcastUpdateRoom(user.room)
      }

      // Set a timer for the user permanent removal
      user.timeout = setTimeout(() => {
        users.delete(ws.deviceId)
        if (roomState.turnsGenerated) {
          // Remove user turn from the turn order
          const index = roomState.turnOrder.indexOf(ws.deviceId)
          if (index !== -1) {
            roomState.turnOrder.splice(index, 1)
            if (index < roomState.currentTurnIndex) {
              roomState.currentTurnIndex--
            } else if (index === roomState.currentTurnIndex) {
              if (roomState.currentTurnIndex >= roomState.turnOrder.length) {
                roomState.currentTurnIndex = roomState.turnOrder.length
              }
            }
            broadcastTurnOrder(user.room)
          }
        } else {
          broadcastUpdateRoom(user.room)
        }
      }, CONFIG.GRACE_PERIOD)
    }
  })
})

// Broadcast login message to a client
const broadcastLoginSuccessful = (deviceId) => {
  const user = getUser(deviceId)
  if (user) {
    clientSend(user.ws, {
      type: 'login-successful',
      deviceId: deviceId,
      username: user.username,
      admin: user.admin,
      room: user.room,
      color: user.color
    })
  }
}

// Broadcast logout message to a client
const broadcastLogoutSuccessful = (deviceId) => {
  const user = getUser(deviceId)
  if (user) {
    clientSend(user.ws, { type: 'logout-successful' })
  }
}

// Broadcast the room update to all clients in the room
const broadcastUpdateRoom = (room) => {
  const usersInRoom = []
  users.forEach((user, deviceId) => {
    if (user.room === room) {
      usersInRoom.push({
        deviceId,
        username: user.username,
        admin: user.admin,
        active: user.active,
        color: user.color
      })
    }
  })
  wss.clients.forEach(client => {
    const clientState = getUser(client?.deviceId) ?? {}
    if (client.readyState === WebSocket.OPEN && clientState.room === room) {
      clientSend(client, {
        type: 'room-update',
        connectedUsers: usersInRoom,
        count: usersInRoom.length
      })
    }
  })
}

// Broadcast the turn order to all clients in the room
const broadcastTurnOrder = (room) => {
  let roomState = getRoomState(room)
  if (!roomState.turnsGenerated) return
  const turnOrderData = roomState.turnOrder.reduce((prev, deviceId) => {
    const user = getUser(deviceId)
    if (!user || user.room !== room) return prev
    return [...prev, {
      deviceId,
      username: user.username,
      admin: user.admin,
      active: user.active,
      color: user.color
    }]
  }, [])
  wss.clients.forEach(client => {
    const clientState = getUser(client?.deviceId) ?? {}
    if (client.readyState === WebSocket.OPEN && clientState.room === room) {
      clientSend(client, {
        type: 'turn-update',
        turnOrder: turnOrderData,
        currentTurnIndex: roomState.currentTurnIndex
      })
    }
  })
}

// Stringify and send a message to a client
const clientSend = (client, msg) => {
  let message = JSON.stringify(msg)
  client.send(message)
}

// Shuffle an array (turns order)
const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}

server.listen(CONFIG.PORT, CONFIG.IP, function () {
  console.log(`Server listening on http://${CONFIG.IP}:${CONFIG.PORT}`)
})