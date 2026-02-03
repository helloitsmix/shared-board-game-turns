# Shared Board Game Turns

This application is a real-time turn management system for board games. It allows users to join rooms, track connected players, and manage turns. Admin users have additional control over the turn order.

---

## Prerequisites

### 1. Node.js and npm
Ensure you have Node.js installed on your system. npm (Node Package Manager) comes bundled with Node.js.  
- Download and install Node.js from [https://nodejs.org/](https://nodejs.org/).
- Verify installation by running the following commands in your terminal:
  ```bash
  node -v
  npm -v
  ```

### 2. Local Network IP Address
The server requires your machine's local IP address to allow other devices on the same network to connect.

- **On Windows**:  
  Open the Command Prompt and run:
  ```bash
  ipconfig
  ```
  Look for the `IPv4 Address` under your active network connection. Example: `192.168.1.105`.

- **On Linux**:  
  Open a terminal and run:
  ```bash
  ifconfig
  ```
  Look for the `inet` address under your active network connection. Example: `192.168.1.105`.

---

## Setup Instructions

### 1. Clone or Download the Repository
Download the project files to your local machine.

### 2. Install Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

### 3. Configure the Application
Edit the `config.js` file to set up the application parameters:

- **IP**: Replace the `IP` field with your machine's local IP address (e.g., `192.168.1.105`).
- **PORT**: Set the port number for the server (default is `3000`).
- **ROOMS**: Customize the list of available rooms (e.g., `['HEROQUEST', 'OTHER']`).
- **DEFAULT_COLOR**: The default highlight color for users when `USE_COLORS` is set to `false`.
- **USE_COLORS**: Set to `true` to allow users to choose their own colors from the `COLORS` list.
- **COLORS**: Define the available colors for users to choose from.
- **GRACE_PERIOD**: The time (in milliseconds) a disconnected user remains in the system before being removed (default is `30 minutes`).
- **BOT_COLOR**: The color assigned to bots in the game.

Example `config.js`:
```javascript
const config = {
  IP: '192.168.1.105',
  PORT: 3000,
  ROOMS: ['HEROQUEST', 'OTHER'],
  GRACE_PERIOD: 30 * 60 * 1000,
  DEFAULT_COLOR: '#FFDC95',
  USE_COLORS: true,
  COLORS: ['#999999', '#D72638', '#F57C00'],
  BOT_COLOR: '#AAAAAA'
};
module.exports = config;
```

### 4. Start the Server
Run the following command in the terminal:
```bash
node server.js
```
The server will start and listen on the configured IP and port.

---

## Application Features

### 1. Room Management
Users can join predefined rooms. You can customize the room names in the `config.js` file.

### 2. Turn Management
- **Admins**:  
  - Admin users can generate the turn order for a room.  
  - Admins can control all turns, including advancing, going back to the previous turn, or regenerating the turn order.
  - Admins can add bots to a room.
  - Admins can remove other players or bots from a room.
- **Regular Users**:  
  - Users can only advance the turn when it is their turn.

### 3. Turn Order
- The turn order is always generated randomly.  
- Admins can regenerate the turn order at any time.

### 4. Grace Period
- When a user disconnects, they remain in the system for the duration of the grace period (default: 30 minutes).  
- During this time, their status is marked as inactive. After the grace period, they are removed from the system.

### 5. Color Customization
- If `USE_COLORS` is set to `true`, users can select their own color from the `COLORS` list.  
- If `USE_COLORS` is set to `false`, all users will use the `DEFAULT_COLOR`.

---

## Troubleshooting

- The application is designed for use on a local network. Devices must be connected to the same network as the server.
- If you are unable to connect to the server, ensure that your device is on the same network as the server.
- If the issue persists, try disabling any active VPN or firewall that might be blocking the connection.

## Notes

- Ensure there is at least one admin in a room to generate the turn order.
- The `config.js` file is the only file you need to modify to customize the application settings. If the config.js file is modified, the server must be restarted (with command: node server.js).