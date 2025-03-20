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
    '#AAAAAA', // – Grigio chiaro
    '#D72638', // – Rosso mattone
    '#F57C00', // – Arancione caldo
    '#F4B400', // – Giallo oro morbido
    '#00875A', // – Verde bosco
    '#0077B6', // – Blu oceano
    '#5E60CE', // – Viola tenue
    '#A35D6A', // – Malva elegante
    '#3D348B', // – Indaco profondo
    '#9C6644', // – Marrone terra di Siena
    '#2D6A4F', // – Verde scuro
    '#FF6347'  // – Rosso corallo
  ]

}

module.exports = config