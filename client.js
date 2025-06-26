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
      connectWebSocket(data.token);
    } else {
      alert('Login failed');
    }
  };
  document.getElementById('auth-section').style.display = 'block';
}

function connectWebSocket(token) {
  const ws = new WebSocket(`ws://localhost:8090/?token=${token}`);
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  ws.onmessage = (event) => {
    console.log('WebSocket message:', event.data);
  };
  ws.onclose = () => {
    console.log('WebSocket closed');
  };
}

window.onload = async () => {
  if (await checkUser()) {
    showLoginForm();
  } else {
    showRegistrationForm();
  }
};
