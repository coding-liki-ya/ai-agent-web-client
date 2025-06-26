const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { createUser, findUserByLogin, createTable } = require('./modelUser');
const pool = require('./db');

const app = express();
const SECRET = 'your_jwt_secret';

app.use(bodyParser.json());
app.use(express.static('.')); // Для отдачи клиентских файлов

// Initialize DB
createTable().catch(console.error);

// Check if user exists
app.get('/login-check', async (req, res) => {
  const result = await pool.query('SELECT COUNT(*) FROM users');
  const count = parseInt(result.rows[0].count, 10);
  if (count > 0) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Registration
app.post('/register', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).send('Missing login or password');
  }
  const existingUser = await findUserByLogin(login);
  if (existingUser) {
    return res.status(400).send('User already exists');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await createUser(login, passwordHash);
  res.status(201).send('User registered');
});

// Login
app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).send('Missing login or password');
  }
  const user = await findUserByLogin(login);
  if (!user) {
    return res.status(400).send('Invalid credentials');
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(400).send('Invalid credentials');
  }
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// WebSocket сервер с проверкой JWT
const wss = new WebSocket.Server({ port: 8090 });

wss.on('connection', (ws, req) => {
  const token = req.url.split('token=')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    ws.userId = payload.userId;
    ws.send(JSON.stringify({ message: 'Authentication successful' }));
  } catch (e) {
    ws.close();
  }

  ws.on('message', message => {
    console.log(`Received message from user ${ws.userId}: ${message}`);
    // Обработка сообщений
  });
});

const server = app.listen(8089, () => {
  console.log('Server listening on port 8089');
});

module.exports = server;
