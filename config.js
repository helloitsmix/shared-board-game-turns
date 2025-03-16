const config = {

  // IP address and port number
  IP: '192.168.1.105', // IPv4 of your local network
  PORT: 3000,

  // List of rooms
  ROOMS: [
    'HEROQUEST',
    'OTHER'
  ],

  // Inactive 
  GRACE_PERIOD: 10000 // 30 * 60 * 1000
}

module.exports = config