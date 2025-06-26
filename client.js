const chat = document.getElementById('chat');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const commandButtons = document.getElementById('commandButtons');
const inputForm = document.getElementById('inputForm');

async function checkUser() {
  const res = await fetch('/login-check');
  return res.status === 200;
}

function showRegistrationForm() {
  document.getElementById('form-title').textContent = 'Register';
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({login, password})
    });
    if (res.ok) {
      alert('Registered successfully');
      showLoginForm();
    } else {
      alert('Registration failed');
    }
  };
  document.getElementById('auth-section').style.display = 'block';
}
let ws ;
function showLoginForm() {
  document.getElementById('form-title').textContent = 'Login';
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const res = await fetch('/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({login, password})
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('jwt', data.token);
      alert('Login successful');
      document.getElementById('auth-section').style.display = 'none';
      ws = connectWebSocket(data.token);
    } else {
      alert('Login failed');
    }
  };
  document.getElementById('auth-section').style.display = 'block';
}

function connectWebSocket(token) {
  let ws = new WebSocket(`ws://${location.hostname}:8090/?token=${token}`);
  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send('/history');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.reply) {
        try {
          const history = JSON.parse(data.reply);
          history.forEach(item => {
            appendMessage(item.role, item.text);
          });
        } catch (e) {
          appendMessage('assistant', data.reply);
        }
        chat.scrollTop = chat.scrollHeight;

        // Перезагрузка страницы при ответе на /reset
        if (lastUserCommand && lastUserCommand === '/reset') {
          location.reload();
        }
      }
    } catch(e) {
      console.error('Invalid JSON:', event.data);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
  };

  return ws;
}

const commands = [
  { cmd: '/plan', desc: 'создать план для цели' },
  { cmd: '/run', desc: 'запустить план по id или текущий' },
  { cmd: '/step', desc: 'выполнить следующий шаг текущего плана' },
  { cmd: '/steps', desc: 'показать все шаги текущего плана' },
  { cmd: '/list', desc: 'показать все сохранённые планы' },
  { cmd: '/use', desc: 'переключиться на план с указанным id' },
  { cmd: '/log', desc: 'показать лог текущего шага' },
  { cmd: '/pause', desc: 'пауза выполнения' },
  { cmd: '/resume', desc: 'продолжить выполнение' },
  { cmd: '/reset', desc: 'сбросить историю и логи' },
  { cmd: '/delete', desc: 'удалить сохранённый план' },
  { cmd: '/history', desc: 'показать историю сокетного общения' },
  { cmd: '/function_call_log', desc: 'показать лог вызовов функций' }
];

function insertCommand(command) {
  input.value = command + (input.value ? ' ' + input.value : '');
  input.focus();
}

function createButtons() {
  commands.forEach(function(item) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.cmd;
    button.title = item.desc;
    button.style.marginRight = '5px';
    button.onclick = function() {
      if(item.cmd === '/function_call_log') {
        window.open('/logtab.html', '_blank');
      } else {
        insertCommand(item.cmd);
      }
    };
    commandButtons.appendChild(button);
  });
}

function decodeHtml(html) {
  var txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function formatMessageText(text) {
  return decodeHtml(text).replace(/&#10;/g, '<br>').replace(/\n/g, '<br>');
}

function appendMessage(role, text) {
  var div = document.createElement('div');
  div.className = role === 'user' ? 'user-message' : 'assistant-message';
  var prefix = role === 'user' ? 'You: ' : 'Assistant: ';
  div.innerHTML = prefix + formatMessageText(text);
  chat.appendChild(div);
}

window.addEventListener('load', async function() {
  createButtons();
  const token = localStorage.getItem('jwt');
  if(token){
    ws = connectWebSocket(token)
  } else {
    if (await checkUser()) {
      showLoginForm();
    } else {
      showRegistrationForm();
    }
  }
});

let lastUserCommand = null;

sendBtn.onclick = function() {
  if(input.value.trim() !== '') {
    lastUserCommand = input.value.trim();
    appendMessage('user', lastUserCommand);
    const token = localStorage.getItem('jwt');
    if(!token){
      alert('Please login first');
      return;
    }
    if (!ws) {
      ws = connectWebSocket(token);
    }
    ws.send(input.value.trim());
    input.value = '';
  }
};

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.onclick();
  }
});

inputForm.addEventListener('submit', async e => {
    e.preventDefault();
});
