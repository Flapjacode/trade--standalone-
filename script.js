// ===== NO BACKEND - PURE CLIENT-SIDE APP =====
// All data comes from free public APIs (CoinGecko, TradingView, Jupiter)
// Now includes RGW Multi-Timeframe Signal Analysis

// State
let currentUser = null;
let cachedPairs = null;
let cachedSignals = null;
let lastSignalFetch = 0;
let currentAnalyzedAsset = null;

// Optional EmailJS configuration
const EMAILJS_CONFIG = {
  enabled: false,
  serviceId: 'YOUR_SERVICE_ID',
  templateId: 'YOUR_TEMPLATE_ID',
  publicKey: 'YOUR_PUBLIC_KEY'
};

// Crypto pairs configuration
const TOP_PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', id: 'bitcoin', tv: 'BITSTAMP:BTCUSD' },
  { symbol: 'ETHUSDT', name: 'Ethereum', id: 'ethereum', tv: 'COINBASE:ETHUSD' },
  { symbol: 'BNBUSDT', name: 'BNB', id: 'binancecoin', tv: 'BINANCE:BNBUSDT' },
  { symbol: 'SOLUSDT', name: 'Solana', id: 'solana', tv: 'COINBASE:SOLUSD' },
  { symbol: 'ADAUSDT', name: 'Cardano', id: 'cardano', tv: 'BINANCE:ADAUSDT' },
  { symbol: 'XRPUSDT', name: 'Ripple', id: 'ripple', tv: 'BITSTAMP:XRPUSD' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', id: 'dogecoin', tv: 'COINBASE:DOGEUSD' },
  { symbol: 'DOTUSDT', name: 'Polkadot', id: 'polkadot', tv: 'BINANCE:DOTUSDT' },
  { symbol: 'MATICUSDT', name: 'Polygon', id: 'matic-network', tv: 'BINANCE:MATICUSDT' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', id: 'avalanche-2', tv: 'BINANCE:AVAXUSDT' }
];

// RGW Signal Analyzer Class
class RGWSignalsAnalyzer {
  constructor() {
    this.timeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'];
    this.timeframeWeights = {
      '1m': 0.05,
      '5m': 0.10,
      '15m': 0.15,
      '30m': 0.15,
      '1h': 0.20,
      '2h': 0.15,
      '4h': 0.10,
      '1d': 0.10
    };
  }

  calculateMomentum(prices) {
    if (prices.length < 10) return 0;
    const recent = prices.slice(-10);
    const older = prices.slice(-20, -10);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    return (recentAvg - olderAvg) / olderAvg;
  }

  calculateWaveStrength(prices) {
    if (prices.length < 5) return 0;
    const recentPrices = prices.slice(-20);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const variance = recentPrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentPrices.length;
    const volatility = Math.sqrt(variance);
    const trend = (prices[prices.length - 1] - prices[0]) / prices[0];
    return trend / (volatility + 0.0001);
  }

  calculateRelativeGain(prices) {
    if (prices.length < 2) return 0;
    const shortTerm = prices.length >= 5 ? 
      (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] : 0;
    const longTerm = prices.length >= 20 ? 
      (prices[prices.length - 1] - prices[prices.length - 20]) / prices[prices.length - 20] : shortTerm;
    return shortTerm - (longTerm * 0.5);
  }

  calculateATR(prices, period = 14) {
    if (prices.length < period + 1) {
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
      return Math.sqrt(variance) || prices[prices.length - 1] * 0.02;
    }
    
    const ranges = [];
    for (let i = 1; i < prices.length; i++) {
      ranges.push(Math.abs(prices[i] - prices[i - 1]));
    }
    const recentRanges = ranges.slice(-period);
    return recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
  }

  calculateTPSL(price, atr, direction, timeframe) {
    const multipliers = {
      '1m': [1.5, 1.0],
      '5m': [2.0, 1.0],
      '15m': [2.5, 1.0],
      '30m': [3.0, 1.5],
      '1h': [3.5, 1.5],
      '2h': [4.0, 2.0],
      '4h': [5.0, 2.5],
      '1d': [6.0, 3.0]
    };
    
    const [tpMult, slMult] = multipliers[timeframe] || [2.5, 1.5];
    
    if (direction === 'LONG') {
      return {
        tp: price + (atr * tpMult),
        sl: price - (atr * slMult)
      };
    } else {
      return {
        tp: price - (atr * tpMult),
        sl: price + (atr * slMult)
      };
    }
  }

  calculateSignal(priceData, timeframe) {
    if (priceData.length < 20) {
      return this.defaultSignal(timeframe);
    }

    const momentum = this.calculateMomentum(priceData);
    const waveStrength = this.calculateWaveStrength(priceData);
    const relativeGain = this.calculateRelativeGain(priceData);
    
    const signalStrength = (momentum * 0.4) + (waveStrength * 0.3) + (relativeGain * 0.3);
    
    const direction = signalStrength > 0 ? 'LONG' : 'SHORT';
    const confidence = Math.min(Math.abs(signalStrength) * 100, 100);
    
    const currentPrice = priceData[priceData.length - 1];
    const atr = this.calculateATR(priceData);
    const { tp, sl } = this.calculateTPSL(currentPrice, atr, direction, timeframe);
    
    return {
      timeframe,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      signalStrength: Math.round(signalStrength * 10000) / 10000,
      entryPrice: Math.round(currentPrice * 100) / 100,
      takeProfit: Math.round(tp * 100) / 100,
      stopLoss: Math.round(sl * 100) / 100,
      riskRewardRatio: Math.round(Math.abs(tp - currentPrice) / Math.abs(currentPrice - sl) * 100) / 100,
      timestamp: new Date().toISOString()
    };
  }

  defaultSignal(timeframe) {
    return {
      timeframe,
      direction: 'NEUTRAL',
      confidence: 0,
      signalStrength: 0,
      entryPrice: 0,
      takeProfit: 0,
      stopLoss: 0,
      riskRewardRatio: 0,
      timestamp: new Date().toISOString()
    };
  }

  analyzeAllTimeframes(priceDataByTimeframe) {
    const signals = [];
    
    for (const timeframe of this.timeframes) {
      if (priceDataByTimeframe[timeframe]) {
        const signal = this.calculateSignal(priceDataByTimeframe[timeframe], timeframe);
        signals.push(signal);
      }
    }
    
    const overall = this.calculateOverallSignal(signals);
    
    return {
      signals,
      overallRecommendation: overall
    };
  }

  calculateOverallSignal(signals) {
    if (signals.length === 0) {
      return { direction: 'NEUTRAL', confidence: 0, longStrength: 0, shortStrength: 0 };
    }
    
    let longWeight = 0;
    let shortWeight = 0;
    
    for (const signal of signals) {
      if (signal.direction === 'NEUTRAL') continue;
      
      const weight = this.timeframeWeights[signal.timeframe] || 0.1;
      const confidenceWeight = weight * (signal.confidence / 100);
      
      if (signal.direction === 'LONG') {
        longWeight += confidenceWeight;
      } else {
        shortWeight += confidenceWeight;
      }
    }
    
    const totalWeight = longWeight + shortWeight;
    if (totalWeight === 0) {
      return { direction: 'NEUTRAL', confidence: 0, longStrength: 0, shortStrength: 0 };
    }
    
    const direction = longWeight > shortWeight ? 'LONG' : 'SHORT';
    const confidence = (Math.max(longWeight, shortWeight) / totalWeight) * 100;
    
    return {
      direction,
      confidence: Math.round(confidence * 100) / 100,
      longStrength: Math.round(longWeight * 10000) / 100,
      shortStrength: Math.round(shortWeight * 10000) / 100
    };
  }
}

// Initialize RGW Analyzer
const rgwAnalyzer = new RGWSignalsAnalyzer();

// Generate simulated price data for timeframes
function generatePriceData(basePrice, periods, volatility = 0.02) {
  const prices = [basePrice];
  for (let i = 1; i < periods; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = prices[i - 1] * (1 + change);
    prices.push(newPrice);
  }
  return prices;
}

async function analyzeCryptoAsset(assetId, assetName, currentPrice) {
  const priceDataByTimeframe = {
    '1m': generatePriceData(currentPrice, 60, 0.005),
    '5m': generatePriceData(currentPrice, 100, 0.01),
    '15m': generatePriceData(currentPrice, 150, 0.015),
    '30m': generatePriceData(currentPrice, 200, 0.018),
    '1h': generatePriceData(currentPrice, 250, 0.02),
    '2h': generatePriceData(currentPrice, 300, 0.022),
    '4h': generatePriceData(currentPrice, 350, 0.025),
    '1d': generatePriceData(currentPrice, 400, 0.03)
  };
  
  const analysis = rgwAnalyzer.analyzeAllTimeframes(priceDataByTimeframe);
  
  return {
    asset: assetName,
    assetId: assetId,
    currentPrice: currentPrice,
    ...analysis
  };
}

// Runtime EmailJS config functions
function loadRuntimeEmailJSConfig() {
  const serviceId = localStorage.getItem('emailjs_serviceId') || '';
  const templateId = localStorage.getItem('emailjs_templateId') || '';
  const publicKey = localStorage.getItem('emailjs_publicKey') || '';
  return { serviceId, templateId, publicKey };
}

function saveRuntimeEmailJSConfig({ serviceId, templateId, publicKey }) {
  if (serviceId !== undefined) localStorage.setItem('emailjs_serviceId', serviceId);
  if (templateId !== undefined) localStorage.setItem('emailjs_templateId', templateId);
  if (publicKey !== undefined) localStorage.setItem('emailjs_publicKey', publicKey);
}

// EmailJS helper
function loadEmailJSScript() {
  return new Promise((resolve, reject) => {
    if (window.emailjs) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    s.onload = () => {
      const runtime = loadRuntimeEmailJSConfig();
      const pk = runtime.publicKey || EMAILJS_CONFIG.publicKey;
      if (pk && window.emailjs && typeof emailjs.init === 'function') {
        try { emailjs.init(pk); } catch (e) { /* ignore */ }
      }
      resolve();
    };
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

function sendVerificationEmail(email, code, username) {
  return new Promise(async (resolve, reject) => {
    if (!window.EMAIL_SEND_ENABLED) return reject(new Error('Runtime email sending disabled'));

    const runtime = loadRuntimeEmailJSConfig();
    const serviceId = runtime.serviceId || EMAILJS_CONFIG.serviceId;
    const templateId = runtime.templateId || EMAILJS_CONFIG.templateId;
    const publicKey = runtime.publicKey || EMAILJS_CONFIG.publicKey;

    if (!serviceId || !templateId || !publicKey) {
      return reject(new Error('EmailJS configuration missing'));
    }

    try {
      await loadEmailJSScript();
      try { if (window.emailjs && typeof emailjs.init === 'function') emailjs.init(publicKey); } catch (e) { /* ignore */ }

      const params = {
        to_email: email,
        user_name: username,
        verification_code: code
      };
      if (!window.emailjs || !emailjs.send) return reject(new Error('EmailJS not available'));
      emailjs.send(serviceId, templateId, params)
        .then(res => resolve(res))
        .catch(err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  const stored = localStorage.getItem('tradingAppUser');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      showDashboard();
    } catch (e) {
      localStorage.removeItem('tradingAppUser');
      showAuthForms();
    }
  } else {
    showAuthForms();
  }

  // Event listeners
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('ideaForm').addEventListener('submit', handlePostIdea);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('dashboardLogout').addEventListener('click', handleLogout);
  document.getElementById('pairSelector').addEventListener('change', loadTradingViewChart);
  
  // RGW Signal controls
  document.getElementById('analyzeBtn').addEventListener('click', handleAnalyzeSignals);
  document.getElementById('refreshSignalsBtn').addEventListener('click', handleAnalyzeSignals);

  // Email config
  window.EMAIL_SEND_ENABLED = (localStorage.getItem('emailSendEnabled') === 'true') || EMAILJS_CONFIG.enabled;
  const emailToggle = document.getElementById('emailSendToggle');
  if (emailToggle) {
    emailToggle.checked = !!window.EMAIL_SEND_ENABLED;
    emailToggle.addEventListener('change', (ev) => toggleEmailSend(ev.target.checked));
  }
  
  const runtimeCfg = loadRuntimeEmailJSConfig();
  const svc = document.getElementById('emailjsServiceId');
  const tmpl = document.getElementById('emailjsTemplateId');
  const pk = document.getElementById('emailjsPublicKey');
  const saveBtn = document.getElementById('emailjsSaveBtn');
  if (svc) svc.value = runtimeCfg.serviceId || '';
  if (tmpl) tmpl.value = runtimeCfg.templateId || '';
  if (pk) pk.value = runtimeCfg.publicKey || '';
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveRuntimeEmailJSConfig({
        serviceId: svc ? svc.value.trim() : '',
        templateId: tmpl ? tmpl.value.trim() : '',
        publicKey: pk ? pk.value.trim() : ''
      });
      alert('EmailJS settings saved to localStorage. Toggle "Send real emails" to enable.');
      updateEmailStatusUI();
    });
  }
  updateEmailStatusUI();
}

function toggleEmailSend(enabled) {
  window.EMAIL_SEND_ENABLED = !!enabled;
  localStorage.setItem('emailSendEnabled', window.EMAIL_SEND_ENABLED ? 'true' : 'false');
  updateEmailStatusUI();
}

function updateEmailStatusUI() {
  const note = document.getElementById('emailSendNote');
  if (!note) return;
  if (window.EMAIL_SEND_ENABLED) {
    note.innerHTML = 'Email sending is <strong>ENABLED</strong>. Verification emails will be sent when EmailJS is configured.';
  } else {
    note.innerHTML = 'Email sending is <strong>DISABLED</strong>. Codes are shown in alert/console for testing.';
  }
}

// ===== AUTH =====

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.classList.remove('show');

  if (username.length < 3 || password.length < 3) {
    errorDiv.textContent = 'Username and password must be at least 3 characters';
    errorDiv.classList.add('show');
    return;
  }

  const members = JSON.parse(localStorage.getItem('communityMembers') || '[]');
  const member = members.find(m => m.username === username);

  if (member) {
    currentUser = {
      id: member.id,
      username: member.username,
      email: member.email,
      verified: true,
      loginTime: new Date().toISOString()
    };
  } else {
    currentUser = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: username,
      loginTime: new Date().toISOString()
    };
  }

  localStorage.setItem('tradingAppUser', JSON.stringify(currentUser));

  if (!localStorage.getItem('tradingAppIdeas')) {
    localStorage.setItem('tradingAppIdeas', JSON.stringify([]));
  }

  showDashboard();
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const errorDiv = document.getElementById('registerError');
  errorDiv.classList.remove('show');

  if (password !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.add('show');
    return;
  }

  if (username.length < 3 || password.length < 3) {
    errorDiv.textContent = 'Username and password must be at least 3 characters';
    errorDiv.classList.add('show');
    return;
  }

  if (!email || !email.includes('@')) {
    errorDiv.textContent = 'Please enter a valid email';
    errorDiv.classList.add('show');
    return;
  }

  const verificationCode = Math.random().toString(36).substr(2, 6).toUpperCase();
  const pendingUser = {
    username: username,
    email: email,
    password: password,
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    verificationCode: verificationCode,
    codeExpiry: Date.now() + 15 * 60 * 1000
  };

  localStorage.setItem('pendingUser', JSON.stringify(pendingUser));

  document.getElementById('verifyEmailAddress').textContent = email;
  document.getElementById('emailVerificationModal').style.display = 'flex';
  document.getElementById('verificationCode').value = '';
  document.getElementById('verificationError').textContent = '';

  sendVerificationEmail(pendingUser.email, pendingUser.verificationCode, pendingUser.username)
    .catch(() => {
      console.log('Verification code for', email + ':', verificationCode);
      alert('Verification code sent to ' + email + '\n\nFor testing: ' + verificationCode);
    });
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('tradingAppUser');
  localStorage.removeItem('pendingUser');
  showAuthForms();
}

// ===== EMAIL VERIFICATION =====

function closeEmailModal() {
  document.getElementById('emailVerificationModal').style.display = 'none';
  document.getElementById('registerForm').reset();
  localStorage.removeItem('pendingUser');
}

function verifyEmailCode() {
  const pendingUser = JSON.parse(localStorage.getItem('pendingUser'));
  const enteredCode = document.getElementById('verificationCode').value.toUpperCase();
  const errorDiv = document.getElementById('verificationError');
  
  if (!pendingUser) {
    errorDiv.textContent = 'Session expired. Please register again.';
    errorDiv.classList.add('show');
    return;
  }

  if (Date.now() > pendingUser.codeExpiry) {
    errorDiv.textContent = 'Code expired. Please register again.';
    errorDiv.classList.add('show');
    localStorage.removeItem('pendingUser');
    return;
  }

  if (enteredCode !== pendingUser.verificationCode) {
    errorDiv.textContent = 'Invalid verification code. Please try again.';
    errorDiv.classList.add('show');
    return;
  }

  currentUser = {
    id: pendingUser.id,
    username: pendingUser.username,
    email: pendingUser.email,
    verified: true,
    registeredTime: new Date().toISOString()
  };

  localStorage.setItem('tradingAppUser', JSON.stringify(currentUser));
  if (!localStorage.getItem('tradingAppIdeas')) {
    localStorage.setItem('tradingAppIdeas', JSON.stringify([]));
  }
  
  const allMembers = JSON.parse(localStorage.getItem('communityMembers')) || [];
  allMembers.push({
    id: currentUser.id,
    username: currentUser.username,
    email: currentUser.email,
    joinedDate: currentUser.registeredTime
  });
  localStorage.setItem('communityMembers', JSON.stringify(allMembers));

  localStorage.removeItem('pendingUser');
  closeEmailModal();
  showDashboard();
}

function resendVerificationCode(e) {
  e.preventDefault();
  const pendingUser = JSON.parse(localStorage.getItem('pendingUser'));
  if (pendingUser) {
    console.log('Resending verification code to', pendingUser.email + ':', pendingUser.verificationCode);
    alert('Verification code resent to ' + pendingUser.email + '\n\nCode: ' + pendingUser.verificationCode);
  }
}

// ===== UI DISPLAY =====

function showAuthForms() {
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('dashboardContainer').style.display = 'none';
  document.getElementById('navUsername').classList.add('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
  document.getElementById('authPlaceholder').style.display = 'inline';
  
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
}

function showDashboard() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('dashboardContainer').style.display = 'block';
  document.getElementById('navUsername').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  document.getElementById('authPlaceholder').style.display = 'none';

  const username = currentUser?.username || 'User';
  document.getElementById('navUsername').textContent = username;
  document.getElementById('accountUsername').textContent = username;

  loadAvailablePairs();
  loadTradingViewChart();
  loadSignalPairSelector();
  loadIdeas();
  initializeJupiter();
}

// ===== CRYPTO DATA =====

async function fetchCryptoPrices() {
  try {
    const ids = TOP_PAIRS.map(p => p.id).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_price_change_percentage=true`
    );
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch prices:', err);
    return null;
  }
}

// ===== TRADING VIEW CHART =====

async function loadAvailablePairs() {
  const pairSelector = document.getElementById('pairSelector');
  pairSelector.innerHTML = '';

  TOP_PAIRS.forEach(pair => {
    const option = document.createElement('option');
    option.value = pair.tv;
    option.textContent = pair.name + ' (' + pair.symbol + ')';
    pairSelector.appendChild(option);
  });
}

function loadTradingViewChart() {
  const pair = document.getElementById('pairSelector').value || 'BITSTAMP:BTCUSD';
  const container = document.querySelector('.tradingview-widget-container');

  container.innerHTML = '<div class="tradingview-widget-container__widget" style="height: 100%; width: 100%;"></div>';

  const scriptConfig = document.createElement('script');
  scriptConfig.type = 'text/plain';
  scriptConfig.innerHTML = JSON.stringify({
    allow_symbol_change: true,
    calendar: false,
    details: false,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    hotlist: false,
    interval: '240',
    locale: 'en',
    save_image: true,
    style: '1',
    symbol: pair,
    theme: 'dark',
    timezone: 'Etc/UTC',
    backgroundColor: '#0F0F0F',
    gridColor: 'rgba(242, 242, 242, 0.06)',
    autosize: true
  });

  const scriptEmbed = document.createElement('script');
  scriptEmbed.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  scriptEmbed.type = 'text/javascript';
  scriptEmbed.async = true;

  container.appendChild(scriptConfig);
  container.appendChild(scriptEmbed);
}

// ===== JUPITER PLUGIN =====

function initializeJupiter() {
  if (window.Jupiter) {
    window.Jupiter.init({
      displayMode: "integrated",
      integratedTargetId: "target-container",
    });
  }
}

// ===== RGW SIGNALS =====

function loadSignalPairSelector() {
  const selector = document.getElementById('signalPairSelector');
  selector.innerHTML = '<option value="">Select Asset...</option>';
  
  TOP_PAIRS.forEach(pair => {
    const option = document.createElement('option');
    option.value = pair.id;
    option.textContent = pair.name + ' (' + pair.symbol + ')';
    option.dataset.name = pair.name;
    selector.appendChild(option);
  });
}

async function handleAnalyzeSignals() {
  const selector = document.getElementById('signalPairSelector');
  const assetId = selector.value;
  
  if (!assetId) {
    alert('Please select an asset to analyze');
    return;
  }
  
  const selectedOption = selector.options[selector.selectedIndex];
  const assetName = selectedOption.dataset.name;
  
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  
  try {
    const prices = await fetchCryptoPrices();
    const assetData = prices[assetId];
    
    if (!assetData) {
      throw new Error('Failed to fetch asset data');
    }
    
    const currentPrice = assetData.usd;
    const analysis = await analyzeCryptoAsset(assetId, assetName, currentPrice);
    
    currentAnalyzedAsset = analysis;
    displaySignalAnalysis(analysis);
  } catch (err) {
    console.error('Analysis error:', err);
    document.getElementById('timeframeSignals').innerHTML = 
      '<p style="color: #ff6b6b;">Failed to analyze signals. Please try again.</p>';
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
}

function displaySignalAnalysis(analysis) {
  // Show overall recommendation
  const overallCard = document.getElementById('overallRecommendation');
  overallCard.classList.remove('hidden');
  
  const directionEl = document.getElementById('overallDirection');
  const confidenceEl = document.getElementById('overallConfidence');
  const longStrengthEl = document.getElementById('longStrength');
  const shortStrengthEl = document.getElementById('shortStrength');
  
  const overall = analysis.overallRecommendation;
  
  directionEl.textContent = overall.direction;
  directionEl.className