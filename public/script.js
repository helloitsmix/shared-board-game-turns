const socket = new WebSocket('ws://192.168.1.105:8080')
const id = uuidv4()
const dungeonNames = ['dungeon master', 'dungeonmaster', 'dungeon', 'master', 'dm', 'diego']

socket.onopen = function (e) {
  console.log("[open] Connessione stabilita", id)
  socket.send(JSON.stringify({ action: 'send-id', data: id }))
};

socket.onmessage = event => {

  data = JSON.parse(event.data)
  console.log(data)

  // Error handling
  if (data.error)
    document.querySelector('#error').textContent = `${data.error}`

  // Update the number of connected clients
  if (data.numClients)
    document.querySelector('#num-clients').textContent = `${data.numClients}`

  // Generate the list
  if (data.arrayOfClients) {
    let html = data.arrayOfClients.map((client, index) => `
          <div class='list-name ${client.name === data.name ? 'bold' : ''} ${dungeonNames.includes(client.name?.toLowerCase()) ? 'dungeon' : ''}'>
            <div>
              <div class='icon'>${client.name === data.name ? '<i class="fa-solid fa-play"></i>' : ''}</div>
              <span class='name'>${client.name}</span>
            </div>
            <span class='number'>${index+1}</span>
          </div>`
    )
    document.querySelector('#turn-list').innerHTML = html.join('')
    const firstName = document.querySelector('.list-name')
    firstName.classList.add('highlighted')

    const ft = document.querySelector('#finish-turn')
    if (ft)
      if (data.id === id)
        ft.classList.remove('hide')
      else
        ft.classList.add('hide')
  }

  // Update the list
  if (data.currentTurn) {
    const namesContainers = document.querySelectorAll('.list-name')
    const ft = document.querySelector('#finish-turn')

    if (ft)
      if (data.id === id)
        ft.classList.remove('hide')
      else
        ft.classList.add('hide')

    namesContainers.forEach((name, index) => {
      if (index === data.currentTurn)
        name.classList.add('highlighted')
      else
        name.classList.remove('highlighted')
    })
  }

  if (data.notification) {
    if (['no-turns'].includes(data.notification))
      document.querySelector('#generate-turn').classList.add('notify')
  }

  if (data.connection) {
    const connectedPlayers = document.querySelector('#connected-players')
    const id = `div-${data.connection}`
    const timer = setTimeout(() => {
      const div = document.querySelector(`#${id}`)
      div.parentNode.removeChild(div)
    }, 7000)
    connectedPlayers.innerHTML = connectedPlayers.innerHTML + `<div class='connected' id='${id}'>${data.connection} si è ${data.connected ? 'connesso' : 'disconnesso'}</div>`
  }
}

// const clearConnectedPlayers = 

const generateTurn = document.querySelector('#generate-turn')
generateTurn.addEventListener('click', () => {
  generateTurn.classList.remove('notify')
  socket.send(JSON.stringify({ action: 'generate' }))
})
generateTurn.classList.add('hide')

const finishTurn = document.querySelector('#finish-turn')
finishTurn.addEventListener('click', () => {
  socket.send(JSON.stringify({ action: 'finish-turn' }))
})
finishTurn.classList.add('hide')

const playerName = document.querySelector('.insert-player-name')
playerName.addEventListener("keydown", (e) => {
  if (e.keyCode === 13 || e.keyCode === 9) {
    const value = document.querySelector('#input-name').value.trim()
    if (value) {
      console.log(value)
      if (dungeonNames.includes(value.toLowerCase())) {
        socket.send(JSON.stringify({ action: 'send-name', data: { name: value, isMaster: true } }))
        generateTurn.classList.remove('hide')
        finishTurn.classList.remove('hide')
        finishTurn.id = 'master-finish'
      } else {
        socket.send(JSON.stringify({ action: 'send-name', data: { name: value, isMaster: false } }))
      }

      const div = document.querySelector('#insert-player-container')
      div.style.display = 'none'
    }
  }
})

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}