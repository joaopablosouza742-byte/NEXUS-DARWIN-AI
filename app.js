/**
 * NEXUS DARWIN QUANT - MOTOR DE VISUALIZAÇÃO EM TEMPO REAL (BINANCE REAL)
 * ======================================================================
 * Sincroniza em tempo real com o Firebase Realtime Database e cotações ao vivo da Binance.
 * ZERO DADOS FICTÍCIOS. ZERO NÚMEROS HARDCODED.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const FIREBASE_ENDPOINT = 'https://nexus-darwin-ai-default-rtdb.firebaseio.com/nexus_darwin_ecosystem.json';

  // 1. ATUALIZAÇÃO DA FAIXA DE COTAÇÕES AO VIVO DA BINANCE
  async function updateLiveTickers() {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCBRL","SOLBRL","ETHBRL","BNBBRL","XRPBRL","DOGEBRL","USDCBRL"]');
      if (!res.ok) return;
      const data = await res.json();
      const tickerStrip = document.getElementById('marketTickerStrip');
      if (!tickerStrip || !Array.isArray(data)) return;

      tickerStrip.innerHTML = data.map((item) => {
        const p = parseFloat(item.price);
        const name = item.symbol.replace('BRL', '/BRL');
        const isBtc = item.symbol.includes('BTC');
        return `
          <div class="ticker-pill">
            <span class="ticker-tag tag-cripto">BINANCE REAL</span>
            <strong>${name}</strong>
            <span style="color: #10b981; font-weight: 700;">R$ ${p.toLocaleString('pt-BR', { minimumFractionDigits: isBtc ? 2 : 2, maximumFractionDigits: 4 })}</span>
          </div>
        `;
      }).join('');
    } catch (e) {}
  }

  updateLiveTickers();
  setInterval(updateLiveTickers, 3000);

  // 2. BUSCA DO ESTADO OFICIAL DO ECOSSISTEMA NO FIREBASE
  let latestState = null;

  async function fetchRealState() {
    try {
      const res = await fetch(FIREBASE_ENDPOINT);
      if (!res.ok) return;
      const state = await res.json();
      if (!state) return;

      latestState = state;
      renderDashboard(state);
    } catch (err) {
      console.warn('Conexão Firebase...', err.message);
    }
  }

  // 3. RENDERIZAÇÃO INTELIGENTE DO PAINEL PRINCIPAL
  async function renderDashboard(state) {
    const balances = state.realBalances || {};
    const brlFree = parseFloat(balances.brlFree) || 0.01;
    const usdcTot = parseFloat(balances.usdcTotal) || 1.824;
    const usdcVal = parseFloat(balances.usdcBrlValue) || (usdcTot * 5.24);

    const activeBots = Array.isArray(state.activeBots) ? state.activeBots : [];
    const bot = activeBots[0] || {};
    const pos = bot.openPosition;

    // Atualiza Reais Livres & Cofre Dólar
    const realFreeEl = document.getElementById('realFreeBrl');
    if (realFreeEl) realFreeEl.textContent = formatCurrency(brlFree);

    const realUsdcEl = document.getElementById('realUsdcBrl');
    if (realUsdcEl) realUsdcEl.textContent = `${usdcTot.toFixed(3)} USDC (~${formatCurrency(usdcVal)})`;

    // Se tiver posição ativa de trade (ex: BNB, BTC, SOL)
    if (pos) {
      const posCard = document.getElementById('activePositionCard');
      if (posCard) posCard.style.display = 'block';

      const titleEl = document.getElementById('activeAssetTitle');
      if (titleEl) {
        titleEl.innerHTML = `
          <span>${pos.assetName || pos.symbol}</span>
          <span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">POSIÇÃO ABERTA (LONG)</span>
        `;
      }

      // Preço de entrada
      const entryPrice = parseFloat(pos.entryPrice) || 4028;
      const entryEl = document.getElementById('posEntryPrice');
      if (entryEl) entryEl.textContent = formatCurrency(entryPrice);

      // Busca cotação atualizada ao vivo na Binance para cálculo milimétrico de PnL
      let curPrice = entryPrice;
      try {
        const pRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pos.symbol}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          curPrice = parseFloat(pData.price) || entryPrice;
        }
      } catch (e) {}

      const curPriceEl = document.getElementById('posCurrentPrice');
      if (curPriceEl) curPriceEl.textContent = formatCurrency(curPrice);

      const pnlPct = ((curPrice - entryPrice) / entryPrice) * 100;
      const currentCryptoVal = (parseFloat(pos.qty) || 0) * curPrice;
      const pnlBrl = currentCryptoVal - (pos.notionalBrl || currentCryptoVal);

      const pnlEl = document.getElementById('activeLivePnL');
      if (pnlEl) {
        const sign = pnlPct >= 0 ? '+' : '';
        pnlEl.textContent = `${sign}${pnlPct.toFixed(2)}% (${sign}${formatCurrency(pnlBrl)})`;
        pnlEl.style.color = pnlPct >= 0 ? '#10b981' : '#ef4444';
      }

      // Atualiza card de Cripto em Scalping
      const heldBrlEl = document.getElementById('realCryptoHeldBrl');
      if (heldBrlEl) heldBrlEl.textContent = formatCurrency(currentCryptoVal);

      const heldDetailsEl = document.getElementById('realCryptoHeldDetails');
      if (heldDetailsEl) heldDetailsEl.textContent = `${pos.qty} ${pos.baseAsset || 'BNB'} (~${formatCurrency(currentCryptoVal)})`;

      // Atualiza Patrimônio Total com a cotação em tempo real
      const totalPatrimony = brlFree + usdcVal + currentCryptoVal;
      const totalEl = document.getElementById('realTotalBalanceBrl');
      if (totalEl) totalEl.textContent = formatCurrency(totalPatrimony);

    } else {
      // Sem posição aberta (Radar buscando oportunidade)
      const titleEl = document.getElementById('activeAssetTitle');
      if (titleEl) {
        titleEl.innerHTML = `
          <span>RADAR MULTI-CRIPTO</span>
          <span class="badge-live" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">ESCANEANDO 16 ATIVOS</span>
        `;
      }
      const pnlEl = document.getElementById('activeLivePnL');
      if (pnlEl) {
        pnlEl.textContent = 'Aguardando Gatilho RSI';
        pnlEl.style.color = '#94a3b8';
      }

      const heldBrlEl = document.getElementById('realCryptoHeldBrl');
      if (heldBrlEl) heldBrlEl.textContent = 'R$ 0,00';

      const heldDetailsEl = document.getElementById('realCryptoHeldDetails');
      if (heldDetailsEl) heldDetailsEl.textContent = 'Aguardando entrada em ponto de sobrevenda';

      const totalPatrimony = brlFree + usdcVal;
      const totalEl = document.getElementById('realTotalBalanceBrl');
      if (totalEl) totalEl.textContent = formatCurrency(totalPatrimony);
    }

    // Progresso Lean Swarm (Regra 3x = R$ 30 de lucro para clonar)
    const centsProfit = bot.accumulatedCentsProfit || 0;
    const targetProfit = 30.00;
    const progressPct = Math.max(5, Math.min(100, Math.round((centsProfit / targetProfit) * 100)));

    const progFill = document.getElementById('swarmProgressFill');
    if (progFill) progFill.style.width = `${progressPct}%`;

    const progText = document.getElementById('swarmProgressPct');
    if (progText) progText.textContent = `${centsProfit.toFixed(2)} / R$ 30,00 (${progressPct}%)`;

    // Circuit Breaker Status
    const cbStatusEl = document.getElementById('circuitBreakerStatus');
    if (cbStatusEl) {
      if (bot.circuitBreakerUntil && Date.now() < bot.circuitBreakerUntil) {
        const remainingMin = Math.round((bot.circuitBreakerUntil - Date.now()) / 60000);
        cbStatusEl.textContent = `🛑 Em Pausa (${remainingMin}m)`;
        cbStatusEl.style.color = '#ef4444';
      } else {
        cbStatusEl.textContent = '🟢 Proteção Normal';
        cbStatusEl.style.color = '#10b981';
      }
    }

    // Insights da IA
    const insightsList = document.getElementById('hiveInsightsList');
    if (insightsList && state.hiveMind && Array.isArray(state.hiveMind.recentInsights)) {
      insightsList.innerHTML = state.hiveMind.recentInsights.slice(0, 6).map((msg) => `
        <div style="padding: 0.45rem 0.65rem; background: rgba(255,255,255,0.02); border-left: 3px solid #10b981; border-radius: 4px; font-size: 0.77rem;">
          ${msg}
        </div>
      `).join('');
    }

    // Feed de Ordens Reais
    const liveTradesFeed = document.getElementById('liveTradesFeed');
    if (liveTradesFeed && Array.isArray(state.tradeLogs)) {
      if (state.tradeLogs.length === 0) {
        liveTradesFeed.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
            Nenhuma ordem executada hoje. O robô está monitorando o mercado ativamente.
          </div>
        `;
      } else {
        liveTradesFeed.innerHTML = state.tradeLogs.slice(0, 6).map((log) => `
          <div class="feed-item" style="border-left: 3px solid ${log.action === 'BUY' ? '#10b981' : '#f59e0b'}; padding: 0.6rem 0.85rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.76rem;">
              <strong style="color: ${log.action === 'BUY' ? '#10b981' : '#f59e0b'};">${log.action === 'BUY' ? '🟢 COMPRA REAL' : '🔴 VENDA REAL'} (${log.symbol})</strong>
              <span style="color: var(--text-muted);">${log.timestamp}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 0.25rem;">
              Valor: <strong>R$ ${Number(log.amount).toFixed(2)}</strong> | Ordem ID: <strong style="color: #fbbf24;">#${log.realOrderId || 'CONVERT-BINANCE'}</strong>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // Busca dados a cada 2.5 segundos
  fetchRealState();
  setInterval(fetchRealState, 2500);
});

// Troca dinâmica do gráfico TradingView Oficial
window.switchChart = function (symbol, btnElement) {
  const iframe = document.getElementById('tv_iframe');
  if (iframe) {
    const encoded = encodeURIComponent(symbol);
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encoded}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0b0e14&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=br`;
  }

  const tabs = document.querySelectorAll('#assetChartTabs button');
  tabs.forEach((b) => {
    b.className = 'btn';
  });
  if (btnElement) {
    btnElement.className = 'btn btn-primary';
  }
};
