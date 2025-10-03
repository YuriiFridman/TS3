const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { register, login, verifyToken } = require('./auth');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store active connections
const clients = new Map(); // userId -> { ws, username, roomId }

// Authentication routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = await register(username, password);
    res.json({ message: 'Registration successful', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const result = await login(username, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Get rooms
app.get('/api/rooms', (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY created_at', (err, rooms) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rooms);
  });
});

// Create room
app.post('/api/rooms', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = verifyToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Room name required' });
  }

  db.run(
    'INSERT INTO rooms (name, created_by) VALUES (?, ?)',
    [name, user.id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Room already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, created_by: user.id });
    }
  );
});

// Get messages for a room
app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  
  db.all(
    `SELECT m.*, u.username 
     FROM messages m 
     JOIN users u ON m.user_id = u.id 
     WHERE m.room_id = ? 
     ORDER BY m.created_at DESC 
     LIMIT 50`,
    [roomId],
    (err, messages) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(messages.reverse());
    }
  );
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  let userId = null;
  let username = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'auth':
          const user = verifyToken(data.token);
          if (user) {
            userId = user.id;
            username = user.username;
            clients.set(userId, { ws, username, roomId: data.roomId || 1 });
            
            // Send current users in room
            broadcastToRoom(data.roomId || 1, {
              type: 'user-joined',
              userId,
              username
            });

            // Send list of users in room
            ws.send(JSON.stringify({
              type: 'users-list',
              users: getUsersInRoom(data.roomId || 1)
            }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            ws.close();
          }
          break;

        case 'join-room':
          if (userId) {
            const oldRoomId = clients.get(userId).roomId;
            clients.get(userId).roomId = data.roomId;
            
            // Notify old room
            broadcastToRoom(oldRoomId, {
              type: 'user-left',
              userId,
              username
            }, userId);

            // Notify new room
            broadcastToRoom(data.roomId, {
              type: 'user-joined',
              userId,
              username
            });

            ws.send(JSON.stringify({
              type: 'users-list',
              users: getUsersInRoom(data.roomId)
            }));
          }
          break;

        case 'chat-message':
          if (userId) {
            const client = clients.get(userId);
            db.run(
              'INSERT INTO messages (room_id, user_id, message) VALUES (?, ?, ?)',
              [client.roomId, userId, data.message],
              function (err) {
                if (!err) {
                  broadcastToRoom(client.roomId, {
                    type: 'chat-message',
                    id: this.lastID,
                    userId,
                    username,
                    message: data.message,
                    timestamp: new Date().toISOString()
                  });
                }
              }
            );
          }
          break;

        case 'webrtc-offer':
        case 'webrtc-answer':
        case 'webrtc-ice-candidate':
          // Forward WebRTC signaling messages to the target peer
          if (data.targetId && clients.has(data.targetId)) {
            const targetClient = clients.get(data.targetId);
            targetClient.ws.send(JSON.stringify({
              ...data,
              fromId: userId,
              fromUsername: username
            }));
          }
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (userId) {
      const client = clients.get(userId);
      if (client) {
        broadcastToRoom(client.roomId, {
          type: 'user-left',
          userId,
          username
        }, userId);
      }
      clients.delete(userId);
    }
  });
});

function getUsersInRoom(roomId) {
  const users = [];
  clients.forEach((client, userId) => {
    if (client.roomId === roomId) {
      users.push({ id: userId, username: client.username });
    }
  });
  return users;
}

function broadcastToRoom(roomId, message, excludeUserId = null) {
  clients.forEach((client, userId) => {
    if (client.roomId === roomId && userId !== excludeUserId) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
