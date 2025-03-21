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
  GRACE_PERIOD: 10000, // 30 * 60 * 1000

  // Single color highlight
  DEFAULT_COLOR: '#FFDC95',

  // Multi color highlight user choice
  USE_COLORS: true,
  COLORS: [
'#999999', // Gray
    '#D72638', // Brick red
    '#F57C00', // Hot orange
    '#F4B400', // Saffron yellow
    '#9C6644', // Brown
    '#2D6A4F', // Viridian
    '#00875A', // Forest green
    '#0077B6', // Cerulean blue
    '#50858B', // Muted Teal
    '#5E60CE', // Iris purple
    '#a44cab', // Indigo
    '#D5A6BD'  // Dusty Rose
  ]
}

module.exports = config