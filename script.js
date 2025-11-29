// ===== NO BACKEND - PURE CLIENT-SIDE APP =====
// All data comes from free public APIs (CoinGecko, TradingView, Jupiter)

// State
let currentUser = null;
let cachedPairs = null;
let cachedSignals = null;
let lastSignalFetch = 0;

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Check if user is already logged in (localStorage only)
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
}

// ===== AUTH (CLIENT-SIDE ONLY) =====

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  errorDiv.classList.remove('show');

  // Simple client-side validation
  if (username.length < 3 || password.length < 3) {
    errorDiv.textContent = 'Username and password must be at least 3 characters';
    errorDiv.classList.add('show');
    return;
  }

  // Store user locally (no backend)
  currentUser = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    username: username,
    loginTime: new Date().toISOString()
  };

  localStorage.setItem('tradingAppUser', JSON.stringify(currentUser));
  
  // Store ideas for this user
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

  // Validation
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

  // Generate verification code
  const verificationCode = Math.random().toString(36).substr(2, 6).toUpperCase();
  const pendingUser = {
    username: username,
    email: email,
    password: password,
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    verificationCode: verificationCode,
    codeExpiry: Date.now() + 15 * 60 * 1000 // 15 minutes
  };

  // Store pending user
  localStorage.setItem('pendingUser', JSON.stringify(pendingUser));

  // Show email verification modal
  document.getElementById('verifyEmailAddress').textContent = email;
  document.getElementById('emailVerificationModal').style.display = 'flex';
  document.getElementById('verificationCode').value = '';
  document.getElementById('verificationError').textContent = '';

  // Try to send email (will fail on GitHub Pages, but we'll show the code in console)
  console.log('Verification code for', email + ':', verificationCode);
  alert('Verification code sent to ' + email + '\\n\\nFor testing: ' + verificationCode);
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

  // Email verified! Create the user account
  currentUser = {
    id: pendingUser.id,
    username: pendingUser.username,
    email: pendingUser.email,
    verified: true,
    registeredTime: new Date().toISOString()
  };

  localStorage.setItem('tradingAppUser', JSON.stringify(currentUser));
  localStorage.setItem('tradingAppIdeas', JSON.stringify([]));
  
  // Store all community members for reference
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
    alert('Verification code resent to ' + pendingUser.email + '\\n\\nCode: ' + pendingUser.verificationCode);
  }
}

// ===== UI DISPLAY =====

function showAuthForms() {
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('dashboardContainer').style.display = 'none';
  document.getElementById('navUsername').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('authPlaceholder').style.display = 'inline';
  
  // Clear forms
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
}

function showDashboard() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('dashboardContainer').style.display = 'block';
  document.getElementById('navUsername').style.display = 'inline';
  document.getElementById('logoutBtn').style.display = 'inline-block';
  document.getElementById('authPlaceholder').style.display = 'none';

  // Update UI with username
  const username = currentUser?.username || 'User';
  document.getElementById('navUsername').textContent = username;
  document.getElementById('accountUsername').textContent = username;

  // Load available pairs
  loadAvailablePairs();
  // Load data
  loadTradingViewChart();
  loadSignals();
  loadIdeas();
  initializeJupiter();
}

// ===== CRYPTO DATA FROM COINGECKO API =====

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

async function generateSignals() {
  const prices = await fetchCryptoPrices();
  
  if (!prices) return [];

  return TOP_PAIRS.map(pair => {
    const priceData = prices[pair.id];
    if (!priceData) return null;

    const currentPrice = priceData.usd || 0;
    const change24h = priceData.usd_24h_change || 0;
    const volume24h = priceData.usd_24h_vol || 0;
    
    // Generate signal: positive change = LONG, negative = SHORT
    const type = change24h > 0 ? 'LONG' : 'SHORT';
    
    // Calculate risk/reward
    const riskPercent = 2;
    const rewardPercent = Math.abs(change24h) * 0.5;
    
    const entryPrice = currentPrice;
    const sl = currentPrice * (1 - (riskPercent / 100));
    const tp = currentPrice * (1 + (rewardPercent / 100));
    const confidence = Math.min(99, Math.abs(change24h) * 2 + 50);

    return {
      id: pair.symbol,
      pair: pair.symbol,
      name: pair.name,
      type,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      targetPrice: parseFloat(tp.toFixed(2)),
      stopLoss: parseFloat(sl.toFixed(2)),
      confidence: Math.floor(confidence),
      priceChange24h: parseFloat(change24h.toFixed(2)),
      volume24h: Math.floor(volume24h)
    };
  }).filter(s => s !== null);
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

  // Clear existing content
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
  if (typeof window !== 'undefined' && window.Jupiter) {
    try {
      window.Jupiter.init({
        displayMode: 'integrated',
        integratedTargetId: 'target-container'
      });
    } catch (e) {
      console.error('Jupiter init failed:', e);
    }
  }
}

// ===== SIGNALS =====

async function loadSignals() {
  const signalsList = document.getElementById('signalsList');
  
  try {
    signalsList.innerHTML = '<p style="color: #888;">Loading signals...</p>';
    
    const signals = await generateSignals();

    if (signals.length === 0) {
      signalsList.innerHTML = '<p style="color: #888;">No signals available.</p>';
      return;
    }

    signalsList.innerHTML = signals.map(signal => `
      <div class="signal-card">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <span class="signal-pair">${signal.name || signal.pair || 'N/A'}</span>
            <span class="signal-type signal-${signal.type?.toLowerCase() || 'long'}">
              ${(signal.type || 'LONG').toUpperCase()}
            </span>
          </div>
          <span style="font-size: 12px; color: ${signal.priceChange24h > 0 ? '#4caf50' : '#f44336'};">
            ${signal.priceChange24h > 0 ? '+' : ''}${signal.priceChange24h || 0}%
          </span>
        </div>
        <div class="signal-confidence" style="margin-top: 8px;">
          <div>Entry: $${signal.entryPrice?.toFixed(2) || 'N/A'}</div>
          <div>Target: $${signal.targetPrice?.toFixed(2) || 'N/A'}</div>
          <div>SL: $${signal.stopLoss?.toFixed(2) || 'N/A'}</div>
          <div style="margin-top: 4px; font-size: 11px; color: #999;">Confidence: ${Math.floor(signal.confidence || 0)}%</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load signals:', err);
    signalsList.innerHTML = '<p style="color: #ff6b6b;">Failed to load signals.</p>';
  }
}

// ===== IDEAS (LOCALSTORAGE) =====

async function handlePostIdea(e) {
  e.preventDefault();

  const title = document.getElementById('ideaTitle').value;
  const description = document.getElementById('ideaDescription').value;
  const symbol = document.getElementById('ideaPair').value;
  const type = document.getElementById('ideaType').value;
  const errorDiv = document.getElementById('ideaError');
  errorDiv.classList.remove('show');

  if (!title || !description || !symbol) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.classList.add('show');
    return;
  }

  try {
    // Create idea object
    const idea = {
      id: 'idea_' + Math.random().toString(36).substr(2, 9),
      authorId: currentUser.id,
      author: currentUser.username,
      title,
      description,
      symbol,
      type: type.toUpperCase(),
      likes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store in localStorage
    const ideas = JSON.parse(localStorage.getItem('tradingAppIdeas') || '[]');
    ideas.unshift(idea); // Add to front
    localStorage.setItem('tradingAppIdeas', JSON.stringify(ideas));

    // Clear form and reload ideas
    document.getElementById('ideaForm').reset();
    await loadIdeas();
  } catch (err) {
    errorDiv.textContent = 'Failed to post idea';
    errorDiv.classList.add('show');
  }
}

async function loadIdeas() {
  const ideasFeed = document.getElementById('ideasFeed');

  try {
    const ideas = JSON.parse(localStorage.getItem('tradingAppIdeas') || '[]');

    if (ideas.length === 0) {
      ideasFeed.innerHTML = '<p style="color: #888;">No ideas yet. Be the first to post!</p>';
      return;
    }

    ideasFeed.innerHTML = ideas.map(idea => `
      <div class="idea-card">
        <div class="idea-header">
          <div>
            <div class="idea-title">${escapeHtml(idea.title)}</div>
            <div class="idea-meta">
              <span style="color: #999; font-size: 12px;">by ${escapeHtml(idea.author || 'Anonymous')}</span>
              <span class="idea-pair">${escapeHtml(idea.symbol || 'N/A')}</span>
              <span class="idea-type idea-type-${(idea.type || 'long').toLowerCase()}">
                ${(idea.type || 'LONG').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <div class="idea-description">${escapeHtml(idea.description)}</div>
        <div class="idea-footer">
          <div class="idea-likes">
            <button class="like-btn" onclick="likeIdea('${idea.id}')">👍</button>
            <span>${idea.likes || 0} likes</span>
          </div>
          <span style="font-size: 12px; color: #666;">${new Date(idea.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load ideas:', err);
    ideasFeed.innerHTML = '<p style="color: #ff6b6b;">Failed to load ideas.</p>';
  }
}

function likeIdea(ideaId) {
  try {
    const ideas = JSON.parse(localStorage.getItem('tradingAppIdeas') || '[]');
    const idea = ideas.find(i => i.id === ideaId);
    
    if (idea) {
      idea.likes = (idea.likes || 0) + 1;
      localStorage.setItem('tradingAppIdeas', JSON.stringify(ideas));
      loadIdeas();
    }
  } catch (err) {
    console.error('Failed to like idea:', err);
  }
}

// ===== UTILITIES =====

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

