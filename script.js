// ===============================
// CONFIG
// ===============================
const DEV_MODE = true;
let currentUser = null;
let pendingUser = null;

// ===============================
// HELPERS
// ===============================
const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

// ===============================
// AUTH STORAGE (CLIENT ONLY)
// ===============================
const AuthStore = {
  users() {
    return JSON.parse(localStorage.getItem('users') || '[]');
  },
  save(users) {
    localStorage.setItem('users', JSON.stringify(users));
  },
  login(username, password) {
    return this.users().find(u => u.username === username && u.password === password);
  },
  register(user) {
    const users = this.users();
    users.push(user);
    this.save(users);
  }
};

// ===============================
// AUTH HANDLERS
// ===============================
$('loginForm').onsubmit = e => {
  e.preventDefault();
  const user = AuthStore.login(
    $('loginUsername').value,
    $('loginPassword').value
  );
  if (!user) {
    $('loginError').textContent = 'Invalid credentials';
    return;
  }
  completeLogin(user);
};

$('registerForm').onsubmit = e => {
  e.preventDefault();

  if ($('regPassword').value !== $('regConfirmPassword').value) {
    $('registerError').textContent = 'Passwords do not match';
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  pendingUser = {
    id: 'user_' + Math.random().toString(36).slice(2),
    username: $('regUsername').value,
    email: $('regEmail').value,
    password: $('regPassword').value,
    code
  };

  if (DEV_MODE) {
    alert(`DEV VERIFICATION CODE: ${code}`);
  }

  show($('verifyModal'));
};

$('verifyBtn').onclick = () => {
  if ($('verifyCode').value !== pendingUser.code) {
    $('verifyError').textContent = 'Invalid code';
    return;
  }

  AuthStore.register(pendingUser);
  completeLogin(pendingUser);
};

$('logoutBtn').onclick = () => {
  localStorage.removeItem('session');
  location.reload();
};

function completeLogin(user) {
  currentUser = user;
  localStorage.setItem('session', JSON.stringify(user));

  $('navUsername').textContent = user.username;
  $('accountUsername').textContent = user.username;

  show($('navUsername'));
  show($('logoutBtn'));
  hide($('authPlaceholder'));

  hide($('authContainer'));
  show($('dashboardContainer'));

  loadAvailablePairs();
  loadTradingViewChart();
  loadSignalPairSelector();
  initializeJupiter();
}

// ===============================
// AUTO LOGIN
// ===============================
const session = JSON.parse(localStorage.getItem('session'));
if (session) completeLogin(session);

// ===============================
// CRYPTO CONFIG
// ===============================
const TOP_PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', id: 'bitcoin', tv: 'BITSTAMP:BTCUSD' },
  { symbol: 'ETHUSDT', name: 'Ethereum', id: 'ethereum', tv: 'COINBASE:ETHUSD' },
  { symbol: 'SOLUSDT', name: 'Solana', id: 'solana', tv: 'COINBASE:SOLUSD' }
];

// ===============================
// COINGECKO
// ===============================
async function fetchCryptoPrices() {
  const ids = TOP_PAIRS.map(p => p.id).join(',');
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
  );
  return res.json();
}

// ===============================
// TRADINGVIEW
// ===============================
function loadAvailablePairs() {
  const sel = $('pairSelector');
  sel.innerHTML = '';
  TOP_PAIRS.forEach(p => {
    const o = document.createElement('option');
    o.value = p.tv;
    o.textContent = `${p.name} (${p.symbol})`;
    sel.appendChild(o);
  });
}

function loadTradingViewChart() {
  const pair = $('pairSelector').value;
  const container = document.querySelector('.tradingview-widget-container');
  container.innerHTML = `
    <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
    <script type="text/javascript">
      new TradingView.widget({
        autosize: true,
        symbol: "${pair}",
        interval: "240",
        theme: "dark",
        locale: "en"
      });
    </script>
  `;
}

// ===============================
// JUPITER
// ===============================
function initializeJupiter() {
  if (window.Jupiter) {
    window.Jupiter.init({
      displayMode: 'integrated',
      integratedTargetId: 'target-container'
    });
  }
}

// ===============================
// RGW SIGNALS (SIMULATED DATA)
// ===============================
class RGWSignalsAnalyzer {
  calculate(prices) {
    const change = (prices.at(-1) - prices[0]) / prices[0];
    return {
      direction: change > 0 ? 'LONG' : 'SHORT',
      confidence: Math.min(Math.abs(change) * 100, 100).toFixed(2)
    };
  }
}

const rgw = new RGWSignalsAnalyzer();

$('analyzeBtn').onclick = async () => {
  const prices = await fetchCryptoPrices();
  const asset = $('signalPairSelector').value;
  const price = prices[asset]?.usd;
  if (!price) return alert('No data');

  const fakePrices = Array.from({ length: 50 }, () => price * (1 + (Math.random() - 0.5) * 0.02));
  const signal = rgw.calculate(fakePrices);

  $('signalsOutput').innerHTML = `
    <strong>${signal.direction}</strong><br>
    Confidence: ${signal.confidence}%
  `;
};

// ===============================
// SIGNAL PAIR SELECTOR
// ===============================
function loadSignalPairSelector() {
  const sel = $('signalPairSelector');
  sel.innerHTML = '<option value="">Select Asset</option>';
  TOP_PAIRS.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  });
}