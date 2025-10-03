const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register user
function register(username, password) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return reject(err);

      db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hash],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return reject(new Error('Username already exists'));
            }
            return reject(err);
          }
          resolve({ id: this.lastID, username });
        }
      );
    });
  });
}

// Login user
function login(username, password) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      (err, user) => {
        if (err) return reject(err);
        if (!user) return reject(new Error('User not found'));

        bcrypt.compare(password, user.password, (err, isValid) => {
          if (err) return reject(err);
          if (!isValid) return reject(new Error('Invalid password'));

          const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          resolve({ token, user: { id: user.id, username: user.username } });
        });
      }
    );
  });
}

// Verify token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { register, login, verifyToken };
