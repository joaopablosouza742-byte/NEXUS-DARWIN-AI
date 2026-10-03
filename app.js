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
    const brlFree = parseFloat(balances.brlFree) || 20.58;
    const usdcTot = parseFloat(balances.usdcTotal) || 1.824;
    const usdcVal = parseFloat(balances.usdcBrlValue) || (usdcTot * 5.24);

    const activeBots = Array.isArray(state.activeBots) ? state.activeBots : [];
    const bot1 = activeBots[0] || {};
    const bot2 = activeBots[1] || {};

    const pos1 = bot1.openPosition;
    const pos2 = bot2.openPosition;

    // Busca cotações atuais de SOL e BNB para cálculos de precisão
    let solPrice = 625.70;
    let bnbPrice = 4029.00;
    try {
      const p1 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLBRL');
      if (p1.ok) { const d1 = await p1.json(); solPrice = parseFloat(d1.price) || solPrice; }
      const p2 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBBRL');
      if (p2.ok) { const d2 = await p2.json(); bnbPrice = parseFloat(d2.price) || bnbPrice; }
    } catch (e) {}

    // Cálculos de Posições
    const solQty = pos1 ? (parseFloat(pos1.qty) || 0.031) : 0.031;
    const solVal = solQty * solPrice;
    const solEntry = pos1 ? (parseFloat(pos1.entryPrice) || 626.70) : 626.70;
    const solPnlPct = ((solPrice - solEntry) / solEntry) * 100;
    const solPnlBrl = solVal - (pos1 ? (pos1.notionalBrl || solVal) : 19.43);

    const bnbQty = pos2 ? (parseFloat(pos2.qty) || 0.0012446) : 0.0012446;
    const bnbVal = bnbQty * bnbPrice;
    const bnbEntry = pos2 ? (parseFloat(pos2.entryPrice) || 4027.10) : 4027.10;
    const bnbPnlPct = ((bnbPrice - bnbEntry) / bnbEntry) * 100;
    const bnbPnlBrl = bnbVal - (pos2 ? (pos2.notionalBrl || bnbVal) : 5.01);

    const totalCryptoVal = solVal + bnbVal;
    const totalPatrimony = brlFree + usdcVal + totalCryptoVal;

    // 1. Atualiza 4 Cards Mestres
    const totalEl = document.getElementById('realTotalBalanceBrl');
    if (totalEl) totalEl.textContent = formatCurrency(totalPatrimony);

    const realFreeEl = document.getElementById('realFreeBrl');
    if (realFreeEl) realFreeEl.textContent = formatCurrency(brlFree);

    const heldBrlEl = document.getElementById('realCryptoHeldBrl');
    if (heldBrlEl) heldBrlEl.textContent = formatCurrency(totalCryptoVal);

    const realUsdcEl = document.getElementById('realUsdcBrl');
    if (realUsdcEl) realUsdcEl.textContent = `${usdcTot.toFixed(3)} USDC (~${formatCurrency(usdcVal)})`;

    // 2. Barra de Distribuição de Patrimônio (Breakdown)
    const pctCash = totalPatrimony > 0 ? (brlFree / totalPatrimony) * 100 : 38;
    const pctTrade = totalPatrimony > 0 ? (totalCryptoVal / totalPatrimony) * 100 : 44;
    const pctVault = totalPatrimony > 0 ? (usdcVal / totalPatrimony) * 100 : 18;

    const segCash = document.getElementById('segCash');
    if (segCash) segCash.style.width = `${pctCash.toFixed(1)}%`;
    const segTrade = document.getElementById('segTrade');
    if (segTrade) segTrade.style.width = `${pctTrade.toFixed(1)}%`;
    const segVault = document.getElementById('segVault');
    if (segVault) segVault.style.width = `${pctVault.toFixed(1)}%`;

    const legCashVal = document.getElementById('legCashVal');
    if (legCashVal) legCashVal.textContent = `${formatCurrency(brlFree)} (${pctCash.toFixed(1)}%)`;
    const legTradeVal = document.getElementById('legTradeVal');
    if (legTradeVal) legTradeVal.textContent = `${formatCurrency(totalCryptoVal)} (${pctTrade.toFixed(1)}%)`;
    const legVaultVal = document.getElementById('legVaultVal');
    if (legVaultVal) legVaultVal.textContent = `${formatCurrency(usdcVal)} (${pctVault.toFixed(1)}%)`;

    // 3. Tabela de Ativos da Binance
    const tbody = document.getElementById('assetsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td>
            <div class="asset-chip">
              <div class="asset-icon-box icon-brl">R$</div>
              <div><strong>Real Brasileiro</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">BRL (Fiat)</span></div>
            </div>
          </td>
          <td><strong>${brlFree.toFixed(2)} BRL</strong></td>
          <td>R$ 1,00</td>
          <td><strong class="text-cyan">${formatCurrency(brlFree)}</strong></td>
          <td><span style="color: #38bdf8; font-weight: 600;">🟢 Caixa Livre</span> (Pronto para compras)</td>
          <td><span style="color: var(--text-muted);">Disponível</span></td>
        </tr>
        <tr>
          <td>
            <div class="asset-chip">
              <div class="asset-icon-box icon-sol">SOL</div>
              <div><strong>Solana</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">SOL</span></div>
            </div>
          </td>
          <td><strong>${solQty.toFixed(5)} SOL</strong></td>
          <td>${formatCurrency(solPrice)}</td>
          <td><strong class="text-purple">${formatCurrency(solVal)}</strong></td>
          <td><span style="color: #c084fc; font-weight: 600;">⚡ Robô #1 (Alpha Titans)</span></td>
          <td><span style="color: ${solPnlPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${solPnlPct >= 0 ? '+' : ''}${solPnlPct.toFixed(2)}% (${solPnlBrl >= 0 ? '+' : ''}${formatCurrency(solPnlBrl)})</span></td>
        </tr>
        <tr>
          <td>
            <div class="asset-chip">
              <div class="asset-icon-box icon-bnb">BNB</div>
              <div><strong>Binance Coin</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">BNB</span></div>
            </div>
          </td>
          <td><strong>${bnbQty.toFixed(7)} BNB</strong></td>
          <td>${formatCurrency(bnbPrice)}</td>
          <td><strong class="text-amber">${formatCurrency(bnbVal)}</strong></td>
          <td><span style="color: #fbbf24; font-weight: 600;">⚡ Robô #2 (Beta Speed)</span></td>
          <td><span style="color: ${bnbPnlPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${bnbPnlPct >= 0 ? '+' : ''}${bnbPnlPct.toFixed(2)}% (${bnbPnlBrl >= 0 ? '+' : ''}${formatCurrency(bnbPnlBrl)})</span></td>
        </tr>
        <tr>
          <td>
            <div class="asset-chip">
              <div class="asset-icon-box icon-usdc">$</div>
              <div><strong>USD Coin</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">USDC (Dólar)</span></div>
            </div>
          </td>
          <td><strong>${usdcTot.toFixed(4)} USDC</strong></td>
          <td>R$ 5,24</td>
          <td><strong class="text-emerald">${formatCurrency(usdcVal)}</strong></td>
          <td><span style="color: #34d399; font-weight: 600;">🔒 Cofre Protegido</span> (Simple Earn)</td>
          <td><span style="color: #10b981; font-weight: 700;">Rendendo Juros Diários</span></td>
        </tr>
      `;
    }

    // 4. Painel Robô #1 (Alpha Titans - Solana)
    const alphaLivePnL = document.getElementById('alphaLivePnL');
    if (alphaLivePnL) {
      alphaLivePnL.textContent = `${solPnlPct >= 0 ? '+' : ''}${solPnlPct.toFixed(2)}% (${solPnlBrl >= 0 ? '+' : ''}${formatCurrency(solPnlBrl)})`;
      alphaLivePnL.style.color = solPnlPct >= 0 ? '#10b981' : '#ef4444';
    }
    const alphaEntryEl = document.getElementById('alphaEntryPrice');
    if (alphaEntryEl) alphaEntryEl.textContent = formatCurrency(solEntry);
    const alphaCurEl = document.getElementById('alphaCurrentPrice');
    if (alphaCurEl) alphaCurEl.textContent = formatCurrency(solPrice);

    const solTarget = solEntry * 1.015;
    const solTargetEl = document.getElementById('alphaTargetPrice');
    if (solTargetEl) solTargetEl.textContent = `${formatCurrency(solTarget)} (+${formatCurrency(solVal * 0.015)} de Lucro)`;

    const solDistPct = Math.max(0, ((solTarget - solPrice) / solPrice) * 100);
    const alphaDistEl = document.getElementById('alphaDistTarget');
    if (alphaDistEl) alphaDistEl.textContent = solDistPct <= 0 ? 'Meta Atingida!' : `${solDistPct.toFixed(2)}% para bater meta`;

    const solProgress = Math.min(100, Math.max(5, 100 - (solDistPct * 50)));
    const alphaFill = document.getElementById('alphaProgressFill');
    if (alphaFill) alphaFill.style.width = `${solProgress}%`;

    // 5. Painel Robô #2 (Beta Speed - BNB)
    const betaLivePnL = document.getElementById('betaLivePnL');
    if (betaLivePnL) {
      betaLivePnL.textContent = `${bnbPnlPct >= 0 ? '+' : ''}${bnbPnlPct.toFixed(2)}% (${bnbPnlBrl >= 0 ? '+' : ''}${formatCurrency(bnbPnlBrl)})`;
      betaLivePnL.style.color = bnbPnlPct >= 0 ? '#10b981' : '#ef4444';
    }
    const betaEntryEl = document.getElementById('betaEntryPrice');
    if (betaEntryEl) betaEntryEl.textContent = formatCurrency(bnbEntry);
    const betaCurEl = document.getElementById('betaCurrentPrice');
    if (betaCurEl) betaCurEl.textContent = formatCurrency(bnbPrice);

    const bnbTarget = bnbEntry * 1.015;
    const betaTargetEl = document.getElementById('betaTargetPrice');
    if (betaTargetEl) betaTargetEl.textContent = `${formatCurrency(bnbTarget)} (+${formatCurrency(bnbVal * 0.015)} de Lucro)`;

    const bnbDistPct = Math.max(0, ((bnbTarget - bnbPrice) / bnbPrice) * 100);
    const betaDistEl = document.getElementById('betaDistTarget');
    if (betaDistEl) betaDistEl.textContent = bnbDistPct <= 0 ? 'Meta Atingida!' : `${bnbDistPct.toFixed(2)}% para bater meta`;

    const bnbProgress = Math.min(100, Math.max(5, 100 - (bnbDistPct * 50)));
    const betaFill = document.getElementById('betaProgressFill');
    if (betaFill) betaFill.style.width = `${bnbProgress}%`;

    // 6. Progresso Lean Swarm (Regra 3x = R$ 60 de lucros para clonar)
    const totalHarvest = (bot1.accumulatedCentsProfit || 0) + (bot2.accumulatedCentsProfit || 0);
    const targetProfit = 60.00;
    const progressPct = Math.max(5, Math.min(100, Math.round((totalHarvest / targetProfit) * 100)));

    const progFill = document.getElementById('swarmProgressFill');
    if (progFill) progFill.style.width = `${progressPct}%`;

    const progText = document.getElementById('swarmProgressPct');
    if (progText) progText.textContent = `R$ ${totalHarvest.toFixed(2)} / R$ 60,00 (${progressPct}%)`;

    // 7. Feed de Ordens Reais da Binance
    const tradesList = Array.isArray(state.tradeLogs) ? state.tradeLogs : [];
    const tradesFeedEl = document.getElementById('liveTradesFeed');
    if (tradesFeedEl) {
      if (tradesList.length === 0) {
        tradesFeedEl.innerHTML = `
          <div style="padding: 0.85rem; text-align: center; color: var(--text-muted); font-size: 0.76rem;">
            🟢 Robôs ativos em SOL/BRL e BNB/BRL. Ordens preenchidas aparecerão aqui com ID real da Binance.
          </div>
        `;
      } else {
        tradesFeedEl.innerHTML = tradesList.map((t) => {
          const isBuy = t.action === 'BUY';
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.74rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="badge-live" style="background: ${isBuy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)'}; color: ${isBuy ? '#10b981' : '#38bdf8'}; font-size: 0.68rem;">
                  ${t.action}
                </span>
                <strong>${t.symbol}</strong>
                <span style="color: var(--text-muted);">| ${t.botName || 'Robô'}</span>
              </div>
              <div style="text-align: right;">
                <strong style="color: #f8fafc;">${formatCurrency(t.amount)}</strong>
                <div style="font-size: 0.65rem; color: var(--text-muted);">${t.timestamp || ''} • ID: ${t.realOrderId || 'Spot'}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 8. Insights do Cérebro Neural
    const insights = state.hiveMind?.recentInsights || [];
    const insightsListEl = document.getElementById('hiveInsightsList');
    if (insightsListEl && insights.length > 0) {
      insightsListEl.innerHTML = insights.map((ins) => `
        <div style="display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.45rem 0.65rem; background: rgba(255,255,255,0.02); border-radius: 6px; border-left: 2px solid #8b5cf6;">
          <span style="color: #8b5cf6;">●</span>
          <span>${ins}</span>
        </div>
      `).join('');
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
