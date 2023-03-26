const express = require('express')
const app = express()
const WebSocket = require('ws')
const PORT = 3000
const IP = "192.168.0.110"

// Serve the index.html file
// app.get('/', function(req, res) {
//   res.sendFile(__dirname + '/index.html')
// })
app.use(express.static(__dirname + '/public'));

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 })
// const wss = new WebSocket("ws://192.168.0.110:8080")
const clients = new Map()
let currentTurn = 0
let arrayOfClients = []

// Initialize an empty array to store client WebSocket connections
// let names = []

// Handle WebSocket connections
wss.on('connection', ws => {

  ws.on('error', (error) => {
    ws.send(JSON.stringify({ error }))
  })

  // const id = uuidv4()
  const metadata = { name: null, id: null, isMaster: false }

  // Add the current client WebSocket connection to the clients map
  clients.set(ws, metadata)
  // ws è la chiave
  // metadata il value
  // --> { ws: metadata }

  // Send the number of connected clients to all clients
  for (let [clientWS] of clients) {
    clientWS.send(JSON.stringify({
      numClients: clients.size
    }))
  }

  ws.on('message', (message) => {

    const { action, data } = JSON.parse(message)

    if (['send-id'].includes(action)) {
      const metadata = clients.get(ws)
      metadata.id = data
    }

    if (['send-name'].includes(action)) {
      const metadata = clients.get(ws)
      metadata.name = data.name
      metadata.isMaster = data.isMaster
    }

    if (['finish-turn'].includes(action)) {
      currentTurn++
      let id = arrayOfClients[currentTurn]?.id

      for (let [clientWS, metadata] of clients) {
        let payload = {
          currentTurn,
          id
        }

        if (!id && metadata.isMaster)
            clientWS.send(JSON.stringify({notification: 'no-turns'}))

        clientWS.send(JSON.stringify(payload))
      }
    }

    if (['generate'].includes(action)) {

      arrayOfClients = []
      currentTurn = 0

      for (let [clientWS, metadata] of clients) {
        arrayOfClients.push(metadata)
      }

      arrayOfClients = shuffle(arrayOfClients)
      let id = arrayOfClients[currentTurn]?.id

      for (let [clientWS, metadata] of clients) {
        let payload = {
          arrayOfClients,
          name: metadata.name,
          id
        }

        clientWS.send(JSON.stringify(payload))
      }
    }

  });

  // Handle WebSocket disconnections
  ws.on('close', () => {
    clients.delete(ws)

    // Send the updated number of connected clients to all clients
    for (let [clientWS] of clients) {
      clientWS.send(JSON.stringify({
        numClients: clients.size
      }))
    }
  })

})

// Start the server
app.listen(PORT, IP || "localhost", () => {
  console.log(`Server started on ${IP}:${PORT}`)
})

// app.listen( ,() => {
//   console.log(`Listening to requests on http://localhost:${port}`);
// });

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