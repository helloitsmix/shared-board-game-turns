const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const CONFIG = require('./config') // Importa la configurazione

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

// Mappa per tenere traccia degli utenti: deviceId => { username, ws, active, timeout }
const users = new Map()

const getUser = (deviceId = '') => {
  if (users.has(deviceId)) {
    return users.get(deviceId)
  }
  return undefined
}

// Mappa per tenere lo stato dei turni per ogni stanza: room => { turnOrder, currentTurnIndex, turnsGenerated }
const rooms = new Map()

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

app.use(express.static('new_public'))

app.get('/config', (req, res) => {
  res.json(CONFIG)
})

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message)
      console.log('data on server:', data)
      if (data.type === 'login') {
        ws.deviceId = data.deviceId
        
        // Se l'utente esiste già (riconnessione) annulla il timer se presente
        const existing = getUser(data.deviceId)
        if (existing) {
          if (existing.timeout) {
            clearTimeout(existing.timeout)
            existing.timeout = null
          }
          existing.username = data.username // Aggiorna il nome se è stato modificato
          existing.admin = data.admin       // Aggiorna il flag admin se è stato modificato
          existing.room = data.room
          existing.active = true
          existing.ws = ws
        } else {
          // Nuovo utente o utente che era stato rimosso definitivamente
          users.set(data.deviceId, {
            username: data.username,
            admin: data.admin,
            room: data.room,
            active: true,
            ws: ws,
            timeout: null
          })
        }

        // single update
        broadcastLoginSuccessful(data.deviceId)
        // room update
        broadcastUpdateRoom(data.room)
        // turn update (if started)
        let roomState = getRoomState(data.room)
        if (roomState.turnsGenerated) {
          if (!roomState.turnOrder.includes(data.deviceId)) {
            roomState.turnOrder.push(data.deviceId)
          }
          broadcastTurnOrder(data.room)
        }
      }

      // TODO: DA PULIRE --- Gestione dei messaggi per il sistema di turni ---

      if (data.type === 'generate-turn') {
        // user who asked to generate turns
        const user = getUser(ws.deviceId) ?? {}
        // Solo gli admin possono generare i turni
        if (!user.admin) return
        const room = user.room
        const roomState = getRoomState(room)
        roomState.turnsGenerated = true
        // Raccogli tutti gli utenti della stanza
        const roomUsers = []
        users.forEach((u, deviceId) => {
          if (u.room === room) {
            roomUsers.push(deviceId)
          }
        })
        // Shuffle casuale
        roomState.turnOrder = shuffle(roomUsers)
        roomState.currentTurnIndex = 0
        broadcastTurnOrder(room)
      }

      if (data.type === 'finish-turn') {
        // Solo l'utente corrente (oppure un admin) può terminare il turno
        const user = getUser(ws.deviceId) ?? {}
        const room = user.room
        let roomState = getRoomState(room)
        // Solo l'utente corrente (o un admin) può terminare il turno
        if (!user.admin && roomState.turnOrder[roomState.currentTurnIndex] !== ws.deviceId) return
        if (roomState.currentTurnIndex < roomState.turnOrder.length) {
          roomState.currentTurnIndex++
        }
        broadcastTurnOrder(room)
      }

      if (data.type === 'prev-turn') {
        const user = getUser(ws.deviceId) ?? {}
        // Solo gli admin possono tornare indietro
        if (!user.admin) return
        const room = user.room
        let roomState = getRoomState(room)
        if (roomState.currentTurnIndex > 0) {
          roomState.currentTurnIndex--
        }
        broadcastTurnOrder(room)
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
        broadcastUpdateRoom(user.room)
      }, CONFIG.GRACE_PERIOD)
    }
  })
})

const broadcastLoginSuccessful = (deviceId) => {
  const user = getUser(deviceId)
  // let client = [...wss.clients].find(c => c.deviceId === deviceId)
  if (user) {
    let client = user.ws
    clientSend(client, {
      type: 'login-successful',
      deviceId: deviceId,
      username: user.username,
      admin: user.admin,
      room: user.room
    })
  }
}

// Funzione per inviare la lista degli utenti attivi a tutti i client di una room
function broadcastUpdateRoom(room) {
  const usersInRoom = []
  users.forEach((user, deviceId) => {
    if (user.room === room) {
      usersInRoom.push({
        deviceId,
        username: user.username,
        admin: user.admin,
        active: user.active
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

const clientSend = (client, msg) => {
  let message = JSON.stringify(msg)
  client.send(message)
}

// Funzione per inviare l'ordine dei turni a tutti i client
function broadcastTurnOrder(room) {
  let roomState = getRoomState(room)
  if (!roomState.turnsGenerated) return
  const turnOrderData = roomState.turnOrder.reduce((prev, deviceId) => {
    const user = getUser(deviceId)
    if (!user || user.room !== room) return prev
    return [...prev, {
      deviceId,
      username: user.username,
      admin: user.admin,
      active: user.active
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

server.listen(CONFIG.PORT, CONFIG.IP, function () {
  console.log(`Server in ascolto su http://${CONFIG.IP}:${CONFIG.PORT}`)
})

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}