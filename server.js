const net = require('net');
const WebSocket = require('ws');

const WS_PORT = 8089;
const DEMON_HOST = '127.0.0.1';
const DEMON_PORT = 9999;

// Функция для отправки JSON с 8-байтовым префиксом длины (big-endian)
function sendJson(socket, obj) {
  const json = JSON.stringify(obj);
  const buf  = Buffer.from(json, 'utf8');      // реальный UTF-8

  // Собираем 8-байтовый big-endian префикс
  const header = Buffer.alloc(8);
  const size   = BigInt(buf.length);
  header.writeBigUInt64BE(size, 0);             // Node.js ≥12.0

  // Шлём сначала заголовок, потом данные
  socket.write(header);
  socket.write(buf);
}

// WebSocket сервер
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`WebSocket server started on ws://localhost:${WS_PORT}`);

wss.on('connection', ws => {
  const demonSocket = net.createConnection({ host: DEMON_HOST, port: DEMON_PORT });

  demonSocket.on('error', err => {
    ws.send(JSON.stringify({ error: 'Daemon connection error: ' + err.message }));
    ws.close();
  });

  demonSocket.on('close', () => {
    ws.close();
  });

  ws.on('message', message => {
    console.log(message.toString())
    sendJson(demonSocket, { text: message.toString() });
  });

  // Буферизация данных демона и отправка когда полный JSON получен
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
