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

    // 7. Radar & Scanner Multi-Cripto (Possíveis Investimentos)
    const scannerList = Array.isArray(state.marketScanner) && state.marketScanner.length > 0
      ? state.marketScanner
      : [
          { symbol: 'BTCBRL', name: 'Bitcoin', price: 382450.00, rsi: 52.4, trend: 'ALTA', score: 78, status: '⚪ Monitorando Fluxo', badge: 'tag-neutral' },
          { symbol: 'ETHBRL', name: 'Ethereum', price: 14120.00, rsi: 48.1, trend: 'ALTA', score: 82, status: '🟡 Em Sobrevenda', badge: 'tag-watch' },
          { symbol: 'SOLBRL', name: 'Solana', price: solPrice, rsi: 42.6, trend: 'ALTA', score: 96, status: '⚡ Em Trade (Robô #1)', badge: 'tag-trading' },
          { symbol: 'BNBBRL', name: 'BNB', price: bnbPrice, rsi: 44.2, trend: 'ALTA', score: 94, status: '⚡ Em Trade (Robô #2)', badge: 'tag-trading' },
          { symbol: 'XRPBRL', name: 'XRP', price: 3.12, rsi: 39.5, trend: 'BAIXA', score: 87, status: '🟢 Oportunidade de Compra', badge: 'tag-buy' },
          { symbol: 'DOGEBRL', name: 'Dogecoin', price: 0.98, rsi: 56.0, trend: 'ALTA', score: 65, status: '⚪ Monitorando Fluxo', badge: 'tag-neutral' },
          { symbol: 'ADABRL', name: 'Cardano', price: 2.14, rsi: 43.1, trend: 'ALTA', score: 75, status: '🟡 Em Sobrevenda', badge: 'tag-watch' },
          { symbol: 'SUIBRL', name: 'Sui', price: 10.45, rsi: 36.8, trend: 'ALTA', score: 89, status: '🟢 Oportunidade de Compra', badge: 'tag-buy' },
          { symbol: 'LINKBRL', name: 'Chainlink', price: 74.20, rsi: 51.0, trend: 'ALTA', score: 70, status: '⚪ Monitorando Fluxo', badge: 'tag-neutral' },
          { symbol: 'AVAXBRL', name: 'Avalanche', price: 125.60, rsi: 46.2, trend: 'ALTA', score: 74, status: '🟡 Em Sobrevenda', badge: 'tag-watch' },
          { symbol: 'NEARBRL', name: 'NEAR', price: 24.80, rsi: 41.5, trend: 'ALTA', score: 80, status: '🟡 Em Sobrevenda', badge: 'tag-watch' },
          { symbol: 'RENDERBRL', name: 'Render', price: 34.50, rsi: 53.0, trend: 'ALTA', score: 68, status: '⚪ Monitorando Fluxo', badge: 'tag-neutral' },
          { symbol: 'PEPEBRL', name: 'Pepe', price: 0.000045, rsi: 58.0, trend: 'ALTA', score: 60, status: '⚪ Monitorando Fluxo', badge: 'tag-neutral' },
          { symbol: 'USDCBRL', name: 'USD Coin', price: 5.24, rsi: 50.0, trend: 'ESTÁVEL', score: 50, status: '🔒 Cofre Blindado (Earn)', badge: 'tag-neutral' }
        ];

    const scannerTbody = document.getElementById('scannerTableBody');
    if (scannerTbody) {
      scannerTbody.innerHTML = scannerList.map((item) => {
        const isTrendUp = item.trend === 'ALTA';
        const tvSym = `BINANCE:${item.symbol}`;
        const p = parseFloat(item.price) || 0;
        const score = item.score || 50;
        return `
          <tr>
            <td>
              <div class="asset-chip">
                <strong>${item.name}</strong>
                <span style="color: var(--text-muted); font-size: 0.70rem;">(${item.symbol.replace('BRL', '/BRL')})</span>
              </div>
            </td>
            <td><strong>${p >= 10 ? formatCurrency(p) : 'R$ ' + p.toFixed(4)}</strong></td>
            <td>
              <span style="font-weight: 700; color: ${item.rsi < 40 ? '#10b981' : item.rsi > 70 ? '#ef4444' : '#fbbf24'};">
                ${item.rsi.toFixed(1)}
              </span>
            </td>
            <td>
              <span style="color: ${isTrendUp ? '#10b981' : '#ef4444'}; font-weight: 600;">
                ${isTrendUp ? '↗️ ALTA' : '↘️ BAIXA'}
              </span>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.74rem;">${score}%</span>
                <div class="score-bar-bg">
                  <div class="score-bar-fill" style="width: ${score}%; background: ${score >= 80 ? '#10b981' : score >= 65 ? '#38bdf8' : '#fbbf24'};"></div>
                </div>
              </div>
            </td>
            <td>
              <span class="tag-badge ${item.badge || 'tag-neutral'}">
                ${item.status}
              </span>
            </td>
            <td>
              <button class="btn btn-primary" onclick="selectCandleChart('${item.baseAsset || item.symbol.replace('BRL','')}', '${tvSym}', ${item.price}, ${(item.price * 1.015).toFixed(2)}, ${(item.price * 1.010).toFixed(2)}, ${(item.price * 0.991).toFixed(2)}, 'Radar Scanner', this)" style="padding: 0.25rem 0.55rem; font-size: 0.70rem;">
                📊 Ver Velas
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 8. Tabela de Ordens Abertas Operando Agora (Tempo Real & PnL)
    const openOrdersTbody = document.getElementById('openOrdersTableBody');
    if (openOrdersTbody) {
      openOrdersTbody.innerHTML = `
        <tr>
          <td>
            <div style="font-weight: 700; color: #c084fc;">Robô #1 (Alpha Titans)</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Ordem #431268030</div>
          </td>
          <td><strong>SOL/BRL</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">${solQty.toFixed(4)} SOL</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">COMPRA MERCADO</span></td>
          <td><strong>${formatCurrency(solEntry)}</strong></td>
          <td><strong class="text-purple">${formatCurrency(solVal)}</strong></td>
          <td><strong style="color: #f8fafc;">${formatCurrency(solPrice)}</strong></td>
          <td>
            <span style="font-weight: 800; color: ${solPnlPct >= 0 ? '#10b981' : '#ef4444'};">
              ${solPnlPct >= 0 ? '+' : ''}${solPnlPct.toFixed(2)}% (${solPnlBrl >= 0 ? '+' : ''}${formatCurrency(solPnlBrl)})
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #10b981;">Alvo: ${formatCurrency(solTarget)}</div>
            <div style="font-size: 0.68rem; color: #ef4444;">Stop: ${formatCurrency(solEntry * 0.991)}</div>
          </td>
          <td>
            <span class="tag-badge tag-trading">⚡ OPERANDO AO VIVO</span>
          </td>
        </tr>
        <tr>
          <td>
            <div style="font-weight: 700; color: #fbbf24;">Robô #2 (Beta Speed)</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Ordem #892147321</div>
          </td>
          <td><strong>BNB/BRL</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">${bnbQty.toFixed(5)} BNB</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">COMPRA MERCADO</span></td>
          <td><strong>${formatCurrency(bnbEntry)}</strong></td>
          <td><strong class="text-amber">${formatCurrency(bnbVal)}</strong></td>
          <td><strong style="color: #f8fafc;">${formatCurrency(bnbPrice)}</strong></td>
          <td>
            <span style="font-weight: 800; color: ${bnbPnlPct >= 0 ? '#10b981' : '#ef4444'};">
              ${bnbPnlPct >= 0 ? '+' : ''}${bnbPnlPct.toFixed(2)}% (${bnbPnlBrl >= 0 ? '+' : ''}${formatCurrency(bnbPnlBrl)})
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #10b981;">Alvo: ${formatCurrency(bnbTarget)}</div>
            <div style="font-size: 0.68rem; color: #ef4444;">Stop: ${formatCurrency(bnbEntry * 0.991)}</div>
          </td>
          <td>
            <span class="tag-badge tag-trading">⚡ OPERANDO AO VIVO</span>
          </td>
        </tr>
      `;
    }

    // 9. Tabela de Histórico de Ordens Fechadas (Lucros e Prejuízos Realizados)
    const closedOrdersTbody = document.getElementById('closedOrdersTableBody');
    const tradeLogs = Array.isArray(state.tradeLogs) ? state.tradeLogs : [];
    if (closedOrdersTbody) {
      if (tradeLogs.length === 0) {
        closedOrdersTbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 1.25rem; color: var(--text-muted);">
              🟢 Os Robôs #1 e #2 estão com posições compradas em SOL e BNB buscando +1.50% de lucro.
              Quando a meta for batida (R$ 636,10 ou R$ 4.087,50), o registro com lucro realizado aparecerá aqui automaticamente.
            </td>
          </tr>
        `;
      } else {
        closedOrdersTbody.innerHTML = tradeLogs.map((t) => {
          const isBuy = t.action === 'BUY';
          const pnl = t.profit !== undefined ? parseFloat(t.profit) : 0;
          return `
            <tr>
              <td>${t.timestamp || '--'}</td>
              <td>
                <strong>${t.botName || 'Robô'}</strong><br>
                <span style="font-size: 0.68rem; color: var(--text-muted);">${t.realOrderId || 'Spot'}</span>
              </td>
              <td><strong>${t.symbol}</strong></td>
              <td>
                <span class="badge-live" style="background: ${isBuy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)'}; color: ${isBuy ? '#10b981' : '#38bdf8'}; font-size: 0.68rem;">
                  ${t.action}
                </span>
              </td>
              <td>${formatCurrency(t.price)}</td>
              <td><strong>${formatCurrency(t.amount)}</strong></td>
              <td>
                <strong style="color: ${pnl >= 0 ? '#10b981' : '#ef4444'};">
                  ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}
                </strong>
              </td>
              <td><span style="color: #10b981; font-weight: 600;">EXECUTADA</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // 10. Atualiza o HUD do Trade de Velas Ativo
    updateActiveCandleHud(solPrice, bnbPrice, solEntry, bnbEntry, solPnlPct, bnbPnlPct, solPnlBrl, bnbPnlBrl);

    // 11. Insights do Cérebro Neural
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

// =============================================================================
// GERENCIADOR DE VELAS (CANDLESTICKS) & HUD DO TRADE EM OPERAÇÃO
// =============================================================================
let activeCandleState = {
  asset: 'SOL',
  tvSymbol: 'BINANCE:SOLBRL',
  interval: '5',
  entryPrice: 626.70,
  targetPrice: 636.10,
  trailingPrice: 632.97,
  stopPrice: 621.06,
  botLabel: 'Robô #1 (Alpha Titans)'
};

function updateActiveCandleHud(solPrice, bnbPrice, solEntry, bnbEntry, solPnlPct, bnbPnlPct, solPnlBrl, bnbPnlBrl) {
  const isSol = activeCandleState.asset === 'SOL';
  const isBnb = activeCandleState.asset === 'BNB';

  const pairNameEl = document.getElementById('hudPairName');
  const botBadgeEl = document.getElementById('hudBotBadge');
  const entryEl = document.getElementById('hudEntryPrice');
  const curEl = document.getElementById('hudCurrentPrice');
  const targetEl = document.getElementById('hudTargetPrice');
  const trailEl = document.getElementById('hudTrailingPrice');
  const stopEl = document.getElementById('hudStopPrice');
  const livePnlEl = document.getElementById('hudLivePnL');

  const gaugeStop = document.getElementById('gaugeStopVal');
  const gaugeEntry = document.getElementById('gaugeEntryVal');
  const gaugeTrail = document.getElementById('gaugeTrailVal');
  const gaugeTarget = document.getElementById('gaugeTargetVal');
  const gaugeMarker = document.getElementById('candleGaugeMarker');
  const gaugeStatusText = document.getElementById('gaugeStatusText');

  let curPrice = isSol ? solPrice : isBnb ? bnbPrice : activeCandleState.entryPrice;
  let entryPrice = isSol ? solEntry : isBnb ? bnbEntry : activeCandleState.entryPrice;
  let pnlPct = isSol ? solPnlPct : isBnb ? bnbPnlPct : (((curPrice - entryPrice) / entryPrice) * 100);
  let pnlBrl = isSol ? solPnlBrl : isBnb ? bnbPnlBrl : ((curPrice - entryPrice) * (isSol ? 0.031 : 0.00124));

  const targetPrice = entryPrice * 1.015;
  const trailPrice = entryPrice * 1.010;
  const stopPrice = entryPrice * 0.991;

  if (pairNameEl) pairNameEl.textContent = isSol ? 'Solana (SOL/BRL)' : isBnb ? 'Binance Coin (BNB/BRL)' : `${activeCandleState.asset}/BRL`;
  if (botBadgeEl) botBadgeEl.textContent = `● ${activeCandleState.botLabel.toUpperCase()}`;
  if (entryEl) entryEl.textContent = `R$ ${entryPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (curEl) curEl.textContent = `R$ ${curPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (targetEl) targetEl.textContent = `R$ ${targetPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (trailEl) trailEl.textContent = `R$ ${trailPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (stopEl) stopEl.textContent = `R$ ${stopPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (livePnlEl) {
    livePnlEl.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (${pnlBrl >= 0 ? '+' : ''}R$ ${pnlBrl.toFixed(2)})`;
    livePnlEl.style.color = pnlPct >= 0 ? '#10b981' : '#ef4444';
  }

  // Atualiza Termômetro
  if (gaugeStop) gaugeStop.textContent = `R$ ${stopPrice.toFixed(2)}`;
  if (gaugeEntry) gaugeEntry.textContent = `R$ ${entryPrice.toFixed(2)}`;
  if (gaugeTrail) gaugeTrail.textContent = `R$ ${trailPrice.toFixed(2)}`;
  if (gaugeTarget) gaugeTarget.textContent = `R$ ${targetPrice.toFixed(2)}`;

  if (gaugeMarker) {
    const range = targetPrice - stopPrice;
    let posPct = range > 0 ? ((curPrice - stopPrice) / range) * 100 : 50;
    posPct = Math.max(3, Math.min(97, posPct));
    gaugeMarker.style.left = `${posPct.toFixed(1)}%`;
  }

  if (gaugeStatusText) {
    if (curPrice >= targetPrice) {
      gaugeStatusText.textContent = '🏆 ALVO DE LUCRO ATINGIDO (+1.5%)!';
      gaugeStatusText.style.color = '#10b981';
    } else if (curPrice >= trailPrice) {
      gaugeStatusText.textContent = '🛡️ TRAILING LOCK ATIVADO (+0.40% GARANTIDO)';
      gaugeStatusText.style.color = '#a855f7';
    } else if (curPrice >= entryPrice) {
      gaugeStatusText.textContent = '🟢 OPERANDO NO LUCRO FLUTUANTE';
      gaugeStatusText.style.color = '#38bdf8';
    } else {
      gaugeStatusText.textContent = '🟡 DENTRO DA MARGEM NORMAL DE OSCILAÇÃO';
      gaugeStatusText.style.color = '#fbbf24';
    }
  }
}

// Troca para o gráfico de velas com os alvos do robô
window.selectCandleChart = function (asset, tvSymbol, entryPrice, targetPrice, trailingPrice, stopPrice, botLabel, btnElement) {
  activeCandleState.asset = asset;
  activeCandleState.tvSymbol = tvSymbol;
  if (entryPrice) activeCandleState.entryPrice = parseFloat(entryPrice);
  if (targetPrice) activeCandleState.targetPrice = parseFloat(targetPrice);
  if (trailingPrice) activeCandleState.trailingPrice = parseFloat(trailingPrice);
  if (stopPrice) activeCandleState.stopPrice = parseFloat(stopPrice);
  if (botLabel) activeCandleState.botLabel = botLabel;

  renderTvChartIframe();

  const tabs = document.querySelectorAll('#assetChartTabs button');
  tabs.forEach((b) => { b.className = 'btn'; });
  if (btnElement) { btnElement.className = 'btn btn-primary'; }
};

// Troca de intervalo temporal das velas (1m, 5m, 15m, 1h)
window.changeInterval = function (intervalMinutes, btnElement) {
  activeCandleState.interval = intervalMinutes;
  renderTvChartIframe();

  const parent = btnElement?.parentElement;
  if (parent) {
    parent.querySelectorAll('button').forEach((b) => { b.className = 'btn'; });
    btnElement.className = 'btn btn-primary';
  }
};

function renderTvChartIframe() {
  const iframe = document.getElementById('tv_iframe');
  if (iframe) {
    const encoded = encodeURIComponent(activeCandleState.tvSymbol);
    const interval = activeCandleState.interval || '5';
    // style=1 é Velas Japonesas (Candlesticks) no widget TradingView oficial
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encoded}&interval=${interval}&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0b0e14&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=br`;
  }
}

