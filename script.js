/*************************
 CONFIG
**************************/
const DEV_MODE = true;

/*************************
 AUTH STATE
**************************/
const AUTH = {
  LOGGED_OUT: 'LOGGED_OUT',
  VERIFYING: 'VERIFYING',
  LOGGED_IN: 'LOGGED_IN'
};

let authState = AUTH.LOGGED_OUT;
let pendingUser = null;

/*************************
 HELPERS
**************************/
function $(id) {
  return document.getElementById(id);
}

function setState(state) {
  authState = state;

  $('authContainer').classList.toggle('hidden', state === AUTH.LOGGED_IN);
  $('dashboardContainer').classList.toggle('hidden', state !== AUTH.LOGGED_IN);
  $('verifyModal').classList.toggle('hidden', state !== AUTH.VERIFYING);
}

/*************************
 STORAGE (BACKEND READY)
**************************/
const AuthAPI = {
  getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
  },
  saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  },
  login(username, password) {
    const users = this.getUsers();
    return users.find(u => u.username === username && u.password === password);
  },
  register(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  }
};

/*************************
 LOGIN
**************************/
$('loginForm').onsubmit = e => {
  e.preventDefault();

  const user = AuthAPI.login(
    $('loginUsername').value,
    $('loginPassword').value
  );

  if (!user) {
    $('loginError').textContent = 'Invalid credentials';
    return;
  }

  localStorage.setItem('session', JSON.stringify(user));
  completeLogin(user);
};

/*************************
 REGISTER
**************************/
$('registerForm').onsubmit = e => {
  e.preventDefault();

  if ($('regPassword').value !== $('regConfirmPassword').value) {
    $('registerError').textContent = 'Passwords do not match';
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  pendingUser = {
    username: $('regUsername').value,
    email: $('regEmail').value,
    password: $('regPassword').value,
    code
  };

  if (DEV_MODE) {
    alert(`DEV OTP: ${code}`);
  }

  setState(AUTH.VERIFYING);
};

/*************************
 VERIFY
**************************/
$('verifyBtn').onclick = () => {
  if ($('verifyCode').value !== pendingUser.code) {
    $('verifyError').textContent = 'Invalid code';
    return;
  }

  AuthAPI.register(pendingUser);
  localStorage.setItem('session', JSON.stringify(pendingUser));

  completeLogin(pendingUser);
};

/*************************
 LOGIN COMPLETE
**************************/
function completeLogin(user) {
  $('navUsername').textContent = user.username;
  $('accountUsername').textContent = user.username;

  $('navUsername').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  $('authPlaceholder').classList.add('hidden');

  setState(AUTH.LOGGED_IN);
}

/*************************
 LOGOUT
**************************/
$('logoutBtn').onclick = () => {
  localStorage.removeItem('session');
  location.reload();
};

/*************************
 AUTO LOGIN
**************************/
const session = JSON.parse(localStorage.getItem('session'));
if (session) {
  completeLogin(session);
}