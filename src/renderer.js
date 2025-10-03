const net = require('net');

// Replace with your server details
const SERVER_HOST = 'your.server.address';
const SERVER_PORT = 12345;

// Create a TCP socket connection
const client = new net.Socket();

// Function to authenticate the user
function authenticate(username, password) {
    // Implement your authentication logic here
    return username === 'user' && password === 'password'; // Example
}

// Connect to the server
client.connect(SERVER_PORT, SERVER_HOST, () => {
    console.log('Connected to server');
});

// Handle incoming data
client.on('data', (data) => {
    console.log('Received: ' + data);
    // Update chat interface with received data
});

// Handle connection errors
client.on('error', (err) => {
    console.error('Connection error: ' + err.message);
});

// Function to send a message
function sendMessage(message) {
    if (client.writable) {
        client.write(message);
    } else {
        console.error('Client is not writable');
    }
}

// Example usage
const username = 'user';
const password = 'password';
if (authenticate(username, password)) {
    sendMessage('Hello, World!');
} else {
    console.error('Authentication failed');
}