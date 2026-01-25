const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const net = require('net');
const WebSocket = require('ws');
const { createUser, findUserByLogin, createTable } = require('./modelUser');
const pool = require('./db');

const WS_PORT = 8090;
const DEMON_HOST = '127.0.0.1';
const DEMON_PORT = 9999;
const SECRET = 'your_jwt_secret';

const app = express();
app.use(bodyParser.json());
app.use(express.static('.'));

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

// WebSocket сервер с JWT аутентификацией
const wss = new WebSocket.Server({ port: WS_PORT });

// Helper для отправки JSON с 8-байтовым префиксом длины (big-endian)
function sendJson(socket, obj) {
  const json = JSON.stringify(obj);
  const buf  = Buffer.from(json, 'utf8');

  const header = Buffer.alloc(8);
  const size   = BigInt(buf.length);
  header.writeBigUInt64BE(size, 0);

  socket.write(header);
  socket.write(buf);
}

wss.on('connection', (ws, req) => {
  // Получаем и проверяем JWT из query параметра
  const token = req.url.split('token=')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    ws.userId = payload.userId;
  } catch (e) {
    ws.close();
    return;
  }

  // Создаем соединение с демоном
  const demonSocket = net.createConnection({ host: DEMON_HOST, port: DEMON_PORT });

  demonSocket.on('error', err => {
    ws.send(JSON.stringify({ error: 'Daemon connection error: ' + err.message }));
    ws.close();
  });

  demonSocket.on('close', () => {
    ws.close();
  });

  ws.on('message', message => {
    sendJson(demonSocket, { text: message.toString() });
  });

  let buffer = Buffer.alloc(0);
  demonSocket.on('data', data => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length >= 8) {
      const hi = buffer.readUInt32BE(0);
      const lo = buffer.readUInt32BE(4);
      const msgLen = hi * 0x100000000 + lo;
      if (buffer.length >= 8 + msgLen) {
        const msgBuf = buffer.slice(8, 8 + msgLen);
        buffer = buffer.slice(8 + msgLen);
        try {
          const obj = JSON.parse(msgBuf.toString('utf-8'));
          ws.send(JSON.stringify({ reply: obj.text || '' }));
        } catch (e) {
          ws.send(JSON.stringify({ error: 'Error parsing daemon response' }));
        }
      } else {
        break;
      }
    }
  });

  ws.on('close', () => {
    demonSocket.end();
  });

  ws.on('error', () => {
    demonSocket.end();
  });
});

const server = app.listen(8089, () => {
  console.log(`Server listening on port 8089`);
});

module.exports = server;
