/* ---------- AUTH ---------- */
const authContainer = document.getElementById('authContainer');
const dashboard = document.getElementById('dashboardContainer');
const navUsername = document.getElementById('navUsername');
const authPlaceholder = document.getElementById('authPlaceholder');
const logoutBtn = document.getElementById('logoutBtn');
const accountUsername = document.getElementById('accountUsername');

function login(username) {
  authContainer.classList.add('hidden');
  dashboard.classList.remove('hidden');

  navUsername.textContent = username;
  navUsername.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  authPlaceholder.classList.add('hidden');

  accountUsername.textContent = username;

  initTradingView();
  initJupiter();
}

loginForm.onsubmit = e => {
  e.preventDefault();
  login(loginUsername.value.trim());
};

registerForm.onsubmit = e => {
  e.preventDefault();
  login(regUsername.value.trim());
};

logoutBtn.onclick = dashboardLogout.onclick = () => location.reload();

/* ---------- PAIRS ---------- */
const pairs = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'BINANCE:SOLUSDT'
];

pairs.forEach(p => {
  pairSelector.innerHTML += `<option value="${p}">${p}</option>`;
  signalPairSelector.innerHTML += `<option value="${p}">${p}</option>`;
});

/* ---------- TRADINGVIEW ---------- */
function initTradingView(symbol = pairs[0]) {
  document.getElementById('tvChart').innerHTML = '';

  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/tv.js';
  script.onload = () => {
    new TradingView.widget({
      container_id: 'tvChart',
      symbol,
      interval: '15',
      theme: 'dark',
      autosize: true
    });
  };
  document.body.appendChild(script);
}

pairSelector.onchange = e => initTradingView(e.target.value);

/* ---------- JUPITER ---------- */
function initJupiter() {
  if (!window.Jupiter) return;

  Jupiter.init({
    displayMode: 'integrated',
    integratedTargetId: 'jupiterTarget',
    endpoint: 'https://api.mainnet-beta.solana.com'
  });
}

/* ---------- SIGNALS ---------- */
analyzeBtn.onclick = () => {
  overallRecommendation.classList.remove('hidden');

  overallDirection.textContent = 'BULLISH';
  overallConfidence.textContent = '72%';
  longStrength.textContent = '8.1';
  shortStrength.textContent = '2.3';

  timeframeSignals.innerHTML = `
    <div class="overall-card">15m – Bullish (70%)</div>
    <div class="overall-card">1h – Neutral (52%)</div>
    <div class="overall-card">4h – Bearish (61%)</div>
  `;
};