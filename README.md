# TS3 Voice Chat Application

A TeamSpeak-like voice and text chat application built with Node.js, Express, WebSocket, WebRTC, JWT authentication, and SQLite database.

## Features

- 🎤 **Real-time Voice Chat** - WebRTC-based peer-to-peer voice communication
- 💬 **Text Chat** - Real-time text messaging in rooms
- 🔐 **User Authentication** - JWT-based secure authentication
- 🏠 **Multiple Rooms** - Create and join different chat rooms
- 👥 **User Presence** - See who's online in each room
- 🎨 **Responsive UI** - Modern, TeamSpeak-inspired interface
- 🔊 **Voice Controls** - Mute/unmute microphone and speakers

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express** - Web server framework
- **WebSocket (ws)** - Real-time bidirectional communication
- **SQLite3** - Lightweight database
- **JWT** - Secure authentication
- **bcryptjs** - Password hashing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling
- **Vanilla JavaScript** - Client-side logic
- **WebRTC** - Peer-to-peer voice communication
- **WebSocket** - Real-time messaging

## Project Structure

```
TS3/
├── server/
│   ├── index.js          # Main server file with Express and WebSocket
│   ├── auth.js           # Authentication logic (JWT, bcrypt)
│   └── database.js       # SQLite database initialization
├── public/
│   ├── index.html        # Main HTML file
│   ├── css/
│   │   └── style.css     # Styles
│   └── js/
│       └── app.js        # Client-side application
├── package.json          # Dependencies
├── .env.example          # Environment variables template
└── README.md            # This file
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YuriiFridman/TS3.git
   cd TS3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file to customize settings:
   ```
   PORT=3000
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   DB_PATH=./database.sqlite
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## Usage

### Registration & Login
1. Open the application in your browser
2. Click on "Register" tab
3. Enter username and password
4. Click "Register"
5. Switch to "Login" tab and login with your credentials

### Voice Chat
1. Allow microphone access when prompted
2. Join a room from the sidebar
3. You'll automatically connect to other users in the room via WebRTC
4. Use the microphone button to mute/unmute yourself
5. Use the speaker button to mute/unmute incoming audio

### Text Chat
1. Type your message in the text input at the bottom
2. Press Enter or click "Send" to send the message
3. Messages are stored in the database and persist across sessions

### Creating Rooms
1. Click the "+" button in the sidebar
2. Enter a room name
3. Click "Create"
4. The new room will appear in the sidebar

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

- `POST /api/login` - Login user
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

### Rooms
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create a new room (requires authentication)
  ```json
  {
    "name": "string"
  }
  ```

### Messages
- `GET /api/rooms/:roomId/messages` - Get messages for a room

## WebSocket Events

### Client → Server
- `auth` - Authenticate with JWT token
- `join-room` - Join a specific room
- `chat-message` - Send a text message
- `webrtc-offer` - WebRTC offer for peer connection
- `webrtc-answer` - WebRTC answer for peer connection
- `webrtc-ice-candidate` - ICE candidate for peer connection

### Server → Client
- `users-list` - List of users in current room
- `user-joined` - User joined the room
- `user-left` - User left the room
- `chat-message` - Incoming text message
- `webrtc-offer` - WebRTC offer from peer
- `webrtc-answer` - WebRTC answer from peer
- `webrtc-ice-candidate` - ICE candidate from peer

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Authentication** - Secure token-based auth
- **Input Validation** - Server-side validation
- **SQL Injection Protection** - Parameterized queries
- **CORS Protection** - Configurable CORS settings

## Browser Compatibility

- Chrome/Edge (recommended for WebRTC)
- Firefox
- Safari (limited WebRTC support)
- Opera

Note: WebRTC features require a secure context (HTTPS) in production or localhost in development.

## Development

### Running in Development Mode
```bash
npm run dev
```

This uses nodemon for automatic server restarts on file changes.

### Testing WebRTC Locally
1. Open the app in multiple browser tabs or windows
2. Login with different users
3. Join the same room
4. Voice chat should connect automatically

### Deploying to Production

1. **Set environment variables**
   - Set a strong `JWT_SECRET`
   - Configure `PORT` if needed
   - Set `DB_PATH` to persistent storage

2. **Use HTTPS**
   - WebRTC requires HTTPS in production
   - Use a reverse proxy like Nginx with SSL certificate

3. **Configure STUN/TURN servers**
   - Update ICE servers in `public/js/app.js` for production
   - Consider using a TURN server for NAT traversal

## Troubleshooting

### Microphone not working
- Check browser permissions
- Ensure you're using HTTPS (or localhost)
- Check browser console for errors

### WebRTC connection fails
- Verify STUN servers are accessible
- Check firewall settings
- Consider adding TURN server for strict NAT environments

### WebSocket disconnects
- Check network stability
- Server automatically reconnects after 3 seconds
- Verify WebSocket port is not blocked

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions, please open an issue on GitHub.
