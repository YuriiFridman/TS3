// Configuration
const API_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}`;

// Global state
let token = localStorage.getItem('token');
let currentUser = null;
let currentRoomId = 1;
let ws = null;
let localStream = null;
let peerConnections = new Map(); // userId -> RTCPeerConnection
let isMicEnabled = true;
let isAudioEnabled = true;

// ICE servers configuration
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const roomsList = document.getElementById('rooms-list');
const usersList = document.getElementById('users-list');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const currentUsername = document.getElementById('current-username');
const currentRoomName = document.getElementById('current-room-name');
const createRoomModal = document.getElementById('create-room-modal');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  setupAppListeners();
  
  if (token) {
    verifyAndConnect();
  }
});

// Auth functions
function setupAuthListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`${tab}-form`).classList.add('active');
    });
  });

  // Login
  document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        errorEl.textContent = '';
        showApp();
      } else {
        errorEl.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      errorEl.textContent = 'Network error';
      console.error(err);
    }
  });

  // Register
  document.getElementById('register-btn').addEventListener('click', async () => {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        errorEl.textContent = '';
        document.querySelector('[data-tab="login"]').click();
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = password;
        alert('Registration successful! Please login.');
      } else {
        errorEl.textContent = data.error || 'Registration failed';
      }
    } catch (err) {
      errorEl.textContent = 'Network error';
      console.error(err);
    }
  });

  // Enter key support
  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('register-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('register-btn').click();
  });
}

function setupAppListeners() {
  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    if (ws) ws.close();
    stopLocalStream();
    closeAllPeerConnections();
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
  });

  // Create room
  document.getElementById('create-room-btn').addEventListener('click', () => {
    createRoomModal.classList.remove('hidden');
    document.getElementById('new-room-name').value = '';
    document.getElementById('create-room-error').textContent = '';
  });

  document.getElementById('create-room-confirm-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-room-name').value.trim();
    const errorEl = document.getElementById('create-room-error');

    if (!name) {
      errorEl.textContent = 'Please enter a room name';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });

      const data = await response.json();

      if (response.ok) {
        createRoomModal.classList.add('hidden');
        loadRooms();
      } else {
        errorEl.textContent = data.error || 'Failed to create room';
      }
    } catch (err) {
      errorEl.textContent = 'Network error';
      console.error(err);
    }
  });

  document.getElementById('create-room-cancel-btn').addEventListener('click', () => {
    createRoomModal.classList.add('hidden');
  });

  // Send message
  document.getElementById('send-message-btn').addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Voice controls
  document.getElementById('toggle-mic-btn').addEventListener('click', toggleMicrophone);
  document.getElementById('toggle-audio-btn').addEventListener('click', toggleAudio);
}

async function verifyAndConnect() {
  try {
    const response = await fetch(`${API_URL}/api/rooms`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      showApp();
    } else {
      localStorage.removeItem('token');
      token = null;
    }
  } catch (err) {
    console.error('Verification failed:', err);
  }
}

async function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  
  // Decode token to get user info
  const payload = JSON.parse(atob(token.split('.')[1]));
  currentUser = { id: payload.id, username: payload.username };
  currentUsername.textContent = currentUser.username;

  // Load rooms
  await loadRooms();

  // Connect WebSocket
  connectWebSocket();

  // Initialize microphone
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    console.log('Microphone initialized');
  } catch (err) {
    console.error('Failed to get microphone access:', err);
    alert('Microphone access denied. Voice chat will not work.');
  }

  // Load messages
  loadMessages(currentRoomId);
}

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({
      type: 'auth',
      token: token,
      roomId: currentRoomId
    }));
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'users-list':
        updateUsersList(data.users);
        break;

      case 'user-joined':
        addUserToList(data.userId, data.username);
        addSystemMessage(`${data.username} joined the room`);
        // Initiate WebRTC connection if other user joined
        if (data.userId !== currentUser.id) {
          createPeerConnection(data.userId, data.username, true);
        }
        break;

      case 'user-left':
        removeUserFromList(data.userId);
        addSystemMessage(`${data.username} left the room`);
        closePeerConnection(data.userId);
        break;

      case 'chat-message':
        addChatMessage(data);
        break;

      case 'webrtc-offer':
        await handleWebRTCOffer(data);
        break;

      case 'webrtc-answer':
        await handleWebRTCAnswer(data);
        break;

      case 'webrtc-ice-candidate':
        await handleICECandidate(data);
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        break;
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    setTimeout(() => {
      if (token) connectWebSocket();
    }, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

async function loadRooms() {
  try {
    const response = await fetch(`${API_URL}/api/rooms`);
    const rooms = await response.json();

    roomsList.innerHTML = '';
    rooms.forEach(room => {
      const roomEl = document.createElement('div');
      roomEl.className = 'room-item';
      if (room.id === currentRoomId) roomEl.classList.add('active');
      roomEl.textContent = room.name;
      roomEl.addEventListener('click', () => joinRoom(room.id, room.name));
      roomsList.appendChild(roomEl);
    });
  } catch (err) {
    console.error('Failed to load rooms:', err);
  }
}

function joinRoom(roomId, roomName) {
  if (roomId === currentRoomId) return;

  // Close existing peer connections
  closeAllPeerConnections();

  currentRoomId = roomId;
  currentRoomName.textContent = roomName;

  // Update active room in UI
  document.querySelectorAll('.room-item').forEach(item => {
    item.classList.remove('active');
    if (item.textContent === roomName) {
      item.classList.add('active');
    }
  });

  // Send join room message
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'join-room',
      roomId: roomId
    }));
  }

  // Load messages
  loadMessages(roomId);
  
  // Clear chat
  chatMessages.innerHTML = '';
}

async function loadMessages(roomId) {
  try {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/messages`);
    const messages = await response.json();

    chatMessages.innerHTML = '';
    messages.forEach(msg => {
      addChatMessage({
        username: msg.username,
        message: msg.message,
        timestamp: msg.created_at
      });
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

function updateUsersList(users) {
  usersList.innerHTML = '';
  users.forEach(user => {
    addUserToList(user.id, user.username);
    // Create peer connection for existing users
    if (user.id !== currentUser.id && !peerConnections.has(user.id)) {
      createPeerConnection(user.id, user.username, true);
    }
  });
}

function addUserToList(userId, username) {
  if (document.getElementById(`user-${userId}`)) return;

  const userEl = document.createElement('div');
  userEl.id = `user-${userId}`;
  userEl.className = 'user-item';
  
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  avatar.textContent = username.charAt(0).toUpperCase();
  
  const nameEl = document.createElement('span');
  nameEl.textContent = username;
  
  userEl.appendChild(avatar);
  userEl.appendChild(nameEl);
  usersList.appendChild(userEl);
}

function removeUserFromList(userId) {
  const userEl = document.getElementById(`user-${userId}`);
  if (userEl) userEl.remove();
}

function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: 'chat-message',
    message: message
  }));

  chatInput.value = '';
}

function addChatMessage(data) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';

  const headerEl = document.createElement('div');
  headerEl.className = 'chat-message-header';

  const usernameEl = document.createElement('span');
  usernameEl.className = 'chat-username';
  usernameEl.textContent = data.username;

  const timestampEl = document.createElement('span');
  timestampEl.className = 'chat-timestamp';
  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
  timestampEl.textContent = time;

  headerEl.appendChild(usernameEl);
  headerEl.appendChild(timestampEl);

  const textEl = document.createElement('div');
  textEl.className = 'chat-text';
  textEl.textContent = data.message;

  msgEl.appendChild(headerEl);
  msgEl.appendChild(textEl);
  chatMessages.appendChild(msgEl);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  msgEl.style.opacity = '0.6';
  msgEl.style.fontStyle = 'italic';

  const textEl = document.createElement('div');
  textEl.className = 'chat-text';
  textEl.textContent = message;

  msgEl.appendChild(textEl);
  chatMessages.appendChild(msgEl);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// WebRTC Functions
async function createPeerConnection(userId, username, isInitiator) {
  if (peerConnections.has(userId) || !localStream) return;

  const pc = new RTCPeerConnection(iceServers);
  peerConnections.set(userId, pc);

  // Add local stream
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc-ice-candidate',
        targetId: userId,
        candidate: event.candidate
      }));
    }
  };

  // Handle remote stream
  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    playRemoteStream(userId, remoteStream);
  };

  // Handle connection state
  pc.onconnectionstatechange = () => {
    console.log(`Connection with ${username}: ${pc.connectionState}`);
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      closePeerConnection(userId);
    }
  };

  // If initiator, create and send offer
  if (isInitiator) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc-offer',
          targetId: userId,
          offer: offer
        }));
      }
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }
}

async function handleWebRTCOffer(data) {
  const { fromId, fromUsername, offer } = data;

  if (!peerConnections.has(fromId) && localStream) {
    await createPeerConnection(fromId, fromUsername, false);
  }

  const pc = peerConnections.get(fromId);
  if (!pc) return;

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc-answer',
        targetId: fromId,
        answer: answer
      }));
    }
  } catch (err) {
    console.error('Error handling offer:', err);
  }
}

async function handleWebRTCAnswer(data) {
  const { fromId, answer } = data;
  const pc = peerConnections.get(fromId);

  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }
}

async function handleICECandidate(data) {
  const { fromId, candidate } = data;
  const pc = peerConnections.get(fromId);

  if (pc && candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }
}

function playRemoteStream(userId, stream) {
  // Check if audio element already exists
  let audioEl = document.getElementById(`audio-${userId}`);
  
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = `audio-${userId}`;
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
  }

  audioEl.srcObject = stream;
}

function closePeerConnection(userId) {
  const pc = peerConnections.get(userId);
  if (pc) {
    pc.close();
    peerConnections.delete(userId);
  }

  const audioEl = document.getElementById(`audio-${userId}`);
  if (audioEl) audioEl.remove();
}

function closeAllPeerConnections() {
  peerConnections.forEach((pc, userId) => {
    closePeerConnection(userId);
  });
  peerConnections.clear();
}

function toggleMicrophone() {
  if (!localStream) return;

  isMicEnabled = !isMicEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = isMicEnabled;
  });

  const btn = document.getElementById('toggle-mic-btn');
  btn.className = isMicEnabled ? 'control-btn mic-on' : 'control-btn mic-off';
}

function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  
  document.querySelectorAll('audio').forEach(audio => {
    audio.muted = !isAudioEnabled;
  });

  const btn = document.getElementById('toggle-audio-btn');
  btn.className = isAudioEnabled ? 'control-btn audio-on' : 'control-btn audio-off';
}

function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}
