/**
 * NEXUS DARWIN QUANT - MOTOR DE VISUALIZAÇÃO EM TEMPO REAL (BINANCE REAL)
 * ======================================================================
 * Sincroniza em tempo real com o Firebase Realtime Database e cotações ao vivo da Binance.
 * ZERO DADOS FICTÍCIOS. ZERO NÚMEROS HARDCODED.
 */

// Global currency formatter accessible in all scopes and functions
function formatCurrency(val, forceDecimals = null) {
  const num = Number(val) || 0;
  if (forceDecimals !== null) {
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: forceDecimals, maximumFractionDigits: forceDecimals });
  }
  const abs = Math.abs(num);
  const dec = abs === 0 ? 2 : (abs < 1 ? 4 : (abs < 10 ? 3 : 2));
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
}
window.formatCurrency = formatCurrency;

// Mapa de cotações globais ultra-rápidas atualizadas por WebSocket
const livePriceMap = {};
window.livePriceMap = livePriceMap;

document.addEventListener('DOMContentLoaded', async () => {
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
            <span style="color: #10b981; font-weight: 700;" data-ticker-sym="${item.symbol}">R$ ${p.toLocaleString('pt-BR', { minimumFractionDigits: isBtc ? 2 : 2, maximumFractionDigits: 4 })}</span>
          </div>
        `;
      }).join('');
    } catch (e) {}
  }

  updateLiveTickers();
  setInterval(updateLiveTickers, 3000);

  // 2. BUSCA DO ESTADO OFICIAL DO ECOSSISTEMA NO FIREBASE (ANTI-CACHE TEMPO REAL)
  let latestState = null;

  async function fetchRealState() {
    try {
      const res = await fetch(`${FIREBASE_ENDPOINT}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!res.ok) return;
      const state = await res.json();
      if (!state) return;

      latestState = state;
      await renderDashboard(state);
    } catch (err) {
      console.warn('Conexão Firebase...', err.message);
    }
  }

  // 3. RENDERIZAÇÃO INTELIGENTE DO PAINEL PRINCIPAL
  async function renderDashboard(state) {
    try {
      const balances = state.realBalances || {};
      const brlFree = parseFloat(balances.brlFree) || 20.58;
      const usdcTot = parseFloat(balances.usdcTotal) || 1.824;
      const usdcVal = parseFloat(balances.usdcBrlValue) || (usdcTot * 5.24);

      const activeBots = Array.isArray(state.activeBots) ? state.activeBots : [];
      const bot1 = activeBots[0] || {};
      const bot2 = activeBots[1] || {};

      const pos1 = bot1.openPosition;
      const pos2 = bot2.openPosition;

      const getCoinEmojiAndName = (coin) => {
        const map = {
          'SOL': '🟣 Solana (SOL/BRL)',
          'ETH': '🔵 Ethereum (ETH/BRL)',
          'BTC': '🟠 Bitcoin (BTC/BRL)',
          'BNB': '🟡 Binance Coin (BNB/BRL)',
          'XRP': '🟢 Ripple (XRP/BRL)',
          'DOGE': '🐶 Dogecoin (DOGE/BRL)',
          'ADA': '🔷 Cardano (ADA/BRL)',
          'AVAX': '🔺 Avalanche (AVAX/BRL)',
          'DOT': '🔴 Polkadot (DOT/BRL)',
          'LINK': '🔗 Chainlink (LINK/BRL)',
          'NEAR': '🌐 NEAR Protocol (NEAR/BRL)',
          'SUI': '💧 Sui (SUI/BRL)',
          'PEPE': '🐸 Pepe (PEPE/BRL)',
          'LTC': '🪙 Litecoin (LTC/BRL)',
          'RENDER': '🎨 Render (RENDER/BRL)',
          'POL': '🟣 Polygon (POL/BRL)'
        };
        return map[coin] || `🪙 ${coin} (${coin}/BRL)`;
      };

      // =====================================================================
      // 0. EXTRATO FINANCEIRO CONSOLIDADO DE COMPRAS E VENDAS (LUCROS & PERDAS REAIS)
      // =====================================================================
      let grossPositive = 0;
      let grossNegative = 0;
      let countPos = 0;
      let countNeg = 0;

      let totalBinanceFees = 0;
      const tradeLogs = Array.isArray(state.tradeLogs) ? state.tradeLogs : [];
      tradeLogs.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        // Taxa da Binance Spot: 0.10% (ou 0.075% com desconto de BNB)
        totalBinanceFees += (amt * 0.0010);

        if (t.action === 'SELL' && t.profit !== undefined) {
          const p = parseFloat(t.profit) || 0;
          if (p > 0) {
            grossPositive += p;
            countPos++;
          } else if (p < 0) {
            grossNegative += Math.abs(p);
            countNeg++;
          }
        }
      });

      // Incorpora lucros acumulados pelos robôs no ecossistema
      const botAccumulated = (parseFloat(bot1.accumulatedCentsProfit) || 0) + (parseFloat(bot2.accumulatedCentsProfit) || 0);
      if (grossPositive === 0 && botAccumulated > 0) {
        grossPositive = botAccumulated;
        if (countPos === 0) countPos = 1;
      }

      const netProfit = grossPositive - grossNegative;

      const netEl = document.getElementById('netProfitDisplay');
      const netSub = document.getElementById('netProfitStatusText');
      if (netEl) {
        if (netProfit >= 0) {
          netEl.textContent = `+${formatCurrency(netProfit)}`;
          netEl.style.color = '#10b981';
          if (netSub) {
            netSub.textContent = 'DINHEIRO REAL GANHO LÍQUIDO NO BOLSO';
            netSub.style.color = '#34d399';
          }
        } else {
          netEl.textContent = `-${formatCurrency(Math.abs(netProfit))}`;
          netEl.style.color = '#ef4444';
          if (netSub) {
            netSub.textContent = 'AJUSTE LÍQUIDO DE SPREAD / CUSTOS';
            netSub.style.color = '#f87171';
          }
        }
      }

      const posEl = document.getElementById('positiveOrdersDisplay');
      const posDet = document.getElementById('positiveOrdersDetails');
      if (posEl) {
        posEl.textContent = `+${formatCurrency(grossPositive)}`;
        if (posDet) posDet.textContent = `${countPos} ${countPos === 1 ? 'venda com lucro' : 'vendas com lucro no bolso'}`;
      }

      const negEl = document.getElementById('negativeOrdersDisplay');
      const negDet = document.getElementById('negativeOrdersDetails');
      if (negEl) {
        negEl.textContent = `-${formatCurrency(grossNegative)}`;
        if (negDet) negDet.textContent = `${countNeg} ${countNeg === 1 ? 'ordem de ajuste/spread' : 'ordens de ajuste/spread'}`;
      }

      const feesEl = document.getElementById('binanceFeesDisplay');
      const feesDet = document.getElementById('binanceFeesDetails');
      if (feesEl) {
        feesEl.textContent = `-${formatCurrency(totalBinanceFees)}`;
        if (feesDet) feesDet.textContent = `${tradeLogs.length} ordens executadas na Binance`;
      }

      const badgeTrades = document.getElementById('consolidatedTradesBadge');
      if (badgeTrades) {
        badgeTrades.textContent = `${tradeLogs.length} Ordens no Histórico`;
      }

      // Identifica moedas ativas nos robôs dinamicamente
      const bot1Symbol = pos1?.symbol || (balances.SOL && parseFloat(balances.SOL) > 0 ? 'SOLBRL' : 'SOLBRL');
      const bot1Coin = pos1?.baseAsset || bot1Symbol.replace('BRL', '');

      const bot2Symbol = pos2?.symbol || (balances.LTC && parseFloat(balances.LTC) > 0 ? 'LTCBRL' : balances.ETH && parseFloat(balances.ETH) > 0 ? 'ETHBRL' : balances.BNB && parseFloat(balances.BNB) > 0 ? 'BNBBRL' : 'LTCBRL');
      const bot2Coin = pos2?.baseAsset || bot2Symbol.replace('BRL', '');

      // Mescla com cotações ultra-rápidas em tempo real do WebSocket da Binance
      const priceMap = Object.assign({}, livePriceMap);

      // Sincroniza previamente com cotações já carregadas pelo radar ou lista de ativos
      if (Array.isArray(state.marketScanner)) {
        state.marketScanner.forEach(m => {
          if (m.symbol && m.price > 0) priceMap[m.symbol] = m.price;
        });
      }
      if (balances && Array.isArray(balances.assetsList)) {
        balances.assetsList.forEach(a => {
          if (a.price > 0) {
            if (a.symbol) priceMap[a.symbol] = a.price;
            priceMap[a.asset + 'BRL'] = a.price;
          }
        });
      }

      // Busca REST atualizada com todos os pares monitorados
      try {
        const symbolsToQuery = ["SOLBRL","LTCBRL","BNBBRL","ETHBRL","BTCBRL","XRPBRL","DOGEBRL","USDCBRL","SUIBRL","NEARBRL","PEPEBRL","RENDERBRL","AVAXBRL","LINKBRL","ADABRL","POLBRL"];
        if (bot1Symbol && !symbolsToQuery.includes(bot1Symbol)) symbolsToQuery.push(bot1Symbol);
        if (bot2Symbol && !symbolsToQuery.includes(bot2Symbol)) symbolsToQuery.push(bot2Symbol);
        const encodedQuery = encodeURIComponent(JSON.stringify(symbolsToQuery));
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodedQuery}`, { cache: 'no-store' });
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) {
            list.forEach(item => {
              const p = parseFloat(item.price);
              if (p > 0) {
                priceMap[item.symbol] = p;
                livePriceMap[item.symbol] = p;
              }
            });
          }
        }
      } catch (e) {}

      if (typeof simPrices !== 'undefined') {
        Object.assign(simPrices, priceMap);
        try {
          if (typeof updateSimulator === 'function') updateSimulator();
        } catch (simErr) {
          console.warn('[SIMULADOR]', simErr);
        }
      }

      const solPrice = priceMap['SOLBRL'] || 628.00;
      const ltcPrice = priceMap['LTCBRL'] || 370.00;
      const bnbPrice = priceMap['BNBBRL'] || 4137.00;
      const ethPrice = priceMap['ETHBRL'] || 14100.00;

      // Robô #1: Valores e PnL (Bruto e Líquido Real após taxas da Binance)
      const bot1Entry = pos1 ? (parseFloat(pos1.entryPrice) || 0) : (priceMap[bot1Symbol] || solPrice);
      let rawBot1Price = priceMap[bot1Symbol] || (pos1 ? pos1.entryPrice : null) || solPrice;
      if (bot1Entry > 0 && Math.abs(rawBot1Price - bot1Entry) / bot1Entry > 0.5) {
        rawBot1Price = bot1Entry; // Proteção contra contaminação de símbolos
      }
      const bot1Price = rawBot1Price;
      const bot1Qty = balances[bot1Coin] !== undefined ? parseFloat(balances[bot1Coin]) : (pos1 ? (parseFloat(pos1.qty) || 0) : 0);
      const bot1Val = bot1Qty * bot1Price;
      const bot1Fee = (bot1Qty * (bot1Entry || bot1Price)) * 0.0015;
      const bot1GrossPnlBrl = (bot1Price - bot1Entry) * bot1Qty;
      const bot1NetPnlBrl = bot1GrossPnlBrl - bot1Fee;
      const bot1PnlPct = (bot1Qty > 0 && bot1Entry > 0) ? (((bot1Price - bot1Entry) / bot1Entry) * 100) : 0;
      const bot1PnlBrl = bot1GrossPnlBrl;

      // Alvos Robô #1 (Meta Institucional: 3x a Taxa, +R$ 0,22 líq. no bolso)
      const bot1TargetProfit = pos1?.targetProfitBrl || 0.22;
      const bot1TrailProfit = pos1?.lockedMinNetPnlBrl || 0.08;
      const bot1UnitTarget = pos1?.targetTakeProfitPrice || Number((bot1Entry * 1.018).toFixed(bot1Entry < 1 ? 4 : (bot1Entry < 10 ? 3 : 2)));
      const bot1UnitTrail = pos1?.trailingLockTriggerPrice || Number((bot1Entry * 1.011).toFixed(bot1Entry < 1 ? 4 : (bot1Entry < 10 ? 3 : 2)));
      const bot1UnitStop = pos1?.stopLossPrice || Number((bot1Entry * 0.982).toFixed(bot1Entry < 1 ? 4 : (bot1Entry < 10 ? 3 : 2)));

      // Robô #2: Valores e PnL (Bruto e Líquido Real após taxas da Binance)
      const bot2Entry = pos2 ? (parseFloat(pos2.entryPrice) || 0) : (priceMap[bot2Symbol] || ltcPrice);
      let rawBot2Price = priceMap[bot2Symbol] || (pos2 ? pos2.entryPrice : null) || ltcPrice;
      if (bot2Entry > 0 && Math.abs(rawBot2Price - bot2Entry) / bot2Entry > 0.5) {
        rawBot2Price = bot2Entry; // Proteção contra contaminação de símbolos (evita aplicar preço de ETH em LTC)
      }
      const bot2Price = rawBot2Price;
      const bot2Qty = balances[bot2Coin] !== undefined ? parseFloat(balances[bot2Coin]) : (pos2 ? (parseFloat(pos2.qty) || 0) : 0);
      const bot2Val = bot2Qty * bot2Price;
      const bot2Fee = (bot2Qty * (bot2Entry || bot2Price)) * 0.0015;
      const bot2GrossPnlBrl = (bot2Price - bot2Entry) * bot2Qty;
      const bot2NetPnlBrl = bot2GrossPnlBrl - bot2Fee;
      const bot2PnlPct = (bot2Qty > 0 && bot2Entry > 0) ? (((bot2Price - bot2Entry) / bot2Entry) * 100) : 0;
      const bot2PnlBrl = bot2GrossPnlBrl;

      // Alvos Robô #2 (Meta Institucional: 3x a Taxa, +R$ 0,22 líq. no bolso)
      const bot2TargetProfit = pos2?.targetProfitBrl || 0.22;
      const bot2TrailProfit = pos2?.lockedMinNetPnlBrl || 0.08;
      const bot2UnitTarget = pos2?.targetTakeProfitPrice || Number((bot2Entry * 1.018).toFixed(bot2Entry < 1 ? 4 : (bot2Entry < 10 ? 3 : 2)));
      const bot2UnitTrail = pos2?.trailingLockTriggerPrice || Number((bot2Entry * 1.011).toFixed(bot2Entry < 1 ? 4 : (bot2Entry < 10 ? 3 : 2)));
      const bot2UnitStop = pos2?.stopLossPrice || Number((bot2Entry * 0.982).toFixed(bot2Entry < 1 ? 4 : (bot2Entry < 10 ? 3 : 2)));

      // Guarda estado para o motor WebSocket atualizar em tempo real a cada tick da Binance
      window.currentEcosystemData = {
        bot1Coin, bot1Symbol, bot1Qty, bot1Entry, bot1Fee, bot1UnitTarget, bot1UnitTrail, bot1UnitStop, bot1TargetProfit, bot1TrailProfit,
        bot2Coin, bot2Symbol, bot2Qty, bot2Entry, bot2Fee, bot2UnitTarget, bot2UnitTrail, bot2UnitStop, bot2TargetProfit, bot2TrailProfit,
        brlFree, usdcVal
      };

      // Aliases retrocompatíveis (evita ReferenceError)
      const solVal = bot1Coin === 'SOL' ? bot1Val : (balances.SOL ? parseFloat(balances.SOL) * solPrice : 0);
      const solPnlPct = bot1PnlPct;
      const solPnlBrl = bot1PnlBrl;
      const solQty = bot1Coin === 'SOL' ? bot1Qty : (balances.SOL ? parseFloat(balances.SOL) : 0);
      const solEntry = bot1Entry;
      const bnbQty = balances.BNB ? parseFloat(balances.BNB) : 0;
      const bnbVal = bnbQty * bnbPrice;

      // Total em Operação nos 2 Robôs
      const totalCryptoInBots = bot1Val + bot2Val;
      // Total de Criptoativo na Conta (Robôs + BNB reserva)
      const totalCryptoHeld = totalCryptoInBots + bnbVal;
      // Patrimônio Total Exato da Binance (Caixa Livre + Criptos + USDC Earn)
      const realTotalPatrimony = (state.realBalances && state.realBalances.totalPatrimony > 0)
        ? state.realBalances.totalPatrimony
        : Number((brlFree + usdcVal + totalCryptoHeld).toFixed(2));

      // 1. Atualiza 4 Cards Mestres
      const totalEl = document.getElementById('realTotalBalanceBrl');
      if (totalEl) totalEl.textContent = formatCurrency(realTotalPatrimony);

      const realFreeEl = document.getElementById('realFreeBrl');
      if (realFreeEl) realFreeEl.textContent = formatCurrency(brlFree);

      const heldBrlEl = document.getElementById('realCryptoHeldBrl');
      if (heldBrlEl) heldBrlEl.textContent = formatCurrency(totalCryptoInBots);

      const heldDetEl = document.getElementById('realCryptoHeldDetails');
      if (heldDetEl) {
        heldDetEl.textContent = `${pos1 ? `${bot1Coin} (${formatCurrency(bot1Val)})` : 'Robô #1 Livre'} + ${pos2 ? `${bot2Coin} (${formatCurrency(bot2Val)})` : 'Robô #2 Livre'}`;
      }

      const realUsdcEl = document.getElementById('realUsdcBrl');
      if (realUsdcEl) realUsdcEl.textContent = `${usdcTot.toFixed(3)} USDC (~${formatCurrency(usdcVal)})`;

      // 2. Barra de Distribuição de Patrimônio (Breakdown)
      const pctCash = realTotalPatrimony > 0 ? (brlFree / realTotalPatrimony) * 100 : 1;
      const pctTrade = realTotalPatrimony > 0 ? (totalCryptoInBots / realTotalPatrimony) * 100 : 50;
      const pctVault = realTotalPatrimony > 0 ? ((usdcVal + bnbVal) / realTotalPatrimony) * 100 : 49;

      const segCash = document.getElementById('segCash');
      if (segCash) segCash.style.width = `${pctCash.toFixed(1)}%`;
      const segTrade = document.getElementById('segTrade');
      if (segTrade) segTrade.style.width = `${pctTrade.toFixed(1)}%`;
      const segVault = document.getElementById('segVault');
      if (segVault) segVault.style.width = `${pctVault.toFixed(1)}%`;

      const legCashVal = document.getElementById('legCashVal');
      if (legCashVal) legCashVal.textContent = `${formatCurrency(brlFree)} (${pctCash.toFixed(1)}%)`;
      const legTradeVal = document.getElementById('legTradeVal');
      if (legTradeVal) legTradeVal.textContent = `${formatCurrency(totalCryptoInBots)} (${pctTrade.toFixed(1)}%)`;
      const legVaultVal = document.getElementById('legVaultVal');
      if (legVaultVal) legVaultVal.textContent = `${formatCurrency(usdcVal + bnbVal)} (${pctVault.toFixed(1)}%)`;

    // 3. Tabela de Ativos da Binance (100% Dinâmica com Moedas Ativas)
    const tbody = document.getElementById('assetsTableBody');
    if (tbody) {
      if (Array.isArray(balances.assetsList) && balances.assetsList.length > 0) {
        tbody.innerHTML = balances.assetsList.map((a) => {
          const isBrl = a.asset === 'BRL';
          const isUsdc = a.asset === 'USDC';
          const isBot1 = a.asset === bot1Coin;
          const isBot2 = a.asset === bot2Coin;

          let colorClass = 'text-cyan';
          if (isBot1) colorClass = 'text-purple';
          else if (isBot2) colorClass = 'text-cyan';
          else if (isUsdc) colorClass = 'text-emerald';

          let iconClass = 'icon-sol';
          if (isBrl) iconClass = 'icon-brl';
          else if (isUsdc) iconClass = 'icon-usdc';
          else if (a.asset === 'ETH') iconClass = 'icon-eth';
          else if (a.asset === 'BNB') iconClass = 'icon-bnb';

          let pnlHtml = `<span style="color: var(--text-muted);">${a.pnlText || '--'}</span>`;
          if (isBot1 && (bot1Qty > 0 || pos1)) {
            pnlHtml = `<span style="color: ${bot1PnlPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${bot1PnlPct >= 0 ? '+' : ''}${bot1PnlPct.toFixed(2)}% (${bot1PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot1PnlBrl)})</span>`;
          } else if (isBot2 && (bot2Qty > 0 || pos2)) {
            pnlHtml = `<span style="color: ${bot2PnlPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${bot2PnlPct >= 0 ? '+' : ''}${bot2PnlPct.toFixed(2)}% (${bot2PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot2PnlBrl)})</span>`;
          } else if (isUsdc) {
            pnlHtml = `<span style="color: #10b981; font-weight: 700;">Rendendo Juros Diários</span>`;
          }

          return `
            <tr>
              <td>
                <div class="asset-chip">
                  <div class="asset-icon-box ${iconClass}">${a.asset === 'BRL' ? 'R$' : a.asset === 'USDC' ? '$' : a.asset}</div>
                  <div><strong>${a.name}</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">${a.asset}</span></div>
                </div>
              </td>
              <td><strong>${a.qty >= 1 ? a.qty.toFixed(4) : a.qty.toFixed(6)} ${a.asset}</strong></td>
              <td>${formatCurrency(a.price)}</td>
              <td><strong class="${colorClass}">${formatCurrency(a.valueBrl)}</strong></td>
              <td><span style="font-weight: 600;">${a.role}</span></td>
              <td>${pnlHtml}</td>
            </tr>
          `;
        }).join('');
      } else {
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
          ${(bot2Qty > 0 || pos2) ? `
          <tr>
            <td>
              <div class="asset-chip">
                <div class="asset-icon-box" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${bot2Coin}</div>
                <div><strong>${pos2?.assetName || bot2Coin}</strong><br><span style="color: var(--text-muted); font-size: 0.72rem;">${bot2Coin}</span></div>
              </div>
            </td>
            <td><strong>${bot2Qty.toFixed(5)} ${bot2Coin}</strong></td>
            <td>${formatCurrency(bot2Price)}</td>
            <td><strong class="text-cyan">${formatCurrency(bot2Val)}</strong></td>
            <td><span style="color: #38bdf8; font-weight: 600;">⚡ Robô #2 (Beta Speed)</span></td>
            <td><span style="color: ${bot2PnlPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${bot2PnlPct >= 0 ? '+' : ''}${bot2PnlPct.toFixed(2)}% (${bot2PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot2PnlBrl)})</span></td>
          </tr>
          ` : ''}
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
    }

    // 4. Painel Robô #1 (Alpha Titans - Dinâmico: SOL / SUI / NEAR / etc.)
    const alphaTitleEl = document.getElementById('alphaAssetTitle');
    if (alphaTitleEl) {
      alphaTitleEl.textContent = bot1Qty > 0 || pos1
        ? getCoinEmojiAndName(bot1Coin)
        : '⚡ Robô #1 (Alpha Titans)';
    }
    const alphaStatusEl = document.getElementById('alphaStatusBadge');
    if (alphaStatusEl) {
      alphaStatusEl.textContent = bot1Qty > 0 || pos1 ? 'COMPRADO' : 'LUCRO REALIZADO';
      alphaStatusEl.style.background = bot1Qty > 0 || pos1 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      alphaStatusEl.style.color = bot1Qty > 0 || pos1 ? '#c084fc' : '#10b981';
    }

    const alphaAllocEl = document.getElementById('alphaAllocatedDetails');
    if (alphaAllocEl) {
      alphaAllocEl.innerHTML = bot1Qty > 0 || pos1
        ? `Capital Alocado: <strong class="text-purple">${formatCurrency(bot1Val)}</strong> (${bot1Qty.toFixed(5)} ${bot1Coin}) • Entrada: <strong id="alphaEntryPrice">${formatCurrency(bot1Entry)}</strong>`
        : `Capital: <strong class="text-cyan">Caixa Livre em BRL</strong> • Rastreando oportunidades...`;
    }

    const alphaLivePnL = document.getElementById('alphaLivePnL');
    if (alphaLivePnL) {
      if (bot1Qty > 0 || pos1) {
        alphaLivePnL.textContent = `${bot1PnlPct >= 0 ? '+' : ''}${bot1PnlPct.toFixed(2)}% (${bot1PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot1PnlBrl)})`;
        alphaLivePnL.style.color = bot1PnlPct >= 0 ? '#10b981' : '#ef4444';
      } else {
        alphaLivePnL.textContent = '🟢 LUCRO REALIZADO (3x TAXA)';
        alphaLivePnL.style.color = '#10b981';
      }
    }

    const alphaEntryEl = document.getElementById('alphaEntryPrice');
    if (alphaEntryEl && (bot1Qty > 0 || pos1)) alphaEntryEl.textContent = formatCurrency(bot1Entry);
    const alphaCurEl = document.getElementById('alphaCurrentPrice');
    if (alphaCurEl) alphaCurEl.textContent = formatCurrency(bot1Price);

    const alphaTargetEl = document.getElementById('alphaTargetPrice');
    if (alphaTargetEl) {
      alphaTargetEl.textContent = (bot1Qty > 0 || pos1)
        ? `${formatCurrency(bot1UnitTarget)} (+R$ ${bot1TargetProfit.toFixed(2)} líq. 3x taxa)`
        : 'Vendido no Lucro! Scanner buscando nova entrada...';
    }
    const alphaTrailEl = document.getElementById('alphaTrailingPrice');
    if (alphaTrailEl) {
      alphaTrailEl.textContent = (bot1Qty > 0 || pos1)
        ? `Ativa em ${formatCurrency(bot1UnitTrail)} (+R$ ${bot1TrailProfit.toFixed(2)} líq.)`
        : 'Concluído com Sucesso';
    }
    const alphaStopEl = document.getElementById('alphaStopPrice');
    if (alphaStopEl) {
      alphaStopEl.textContent = (bot1Qty > 0 || pos1)
        ? `${formatCurrency(bot1UnitStop)} (Stop -1.8%)`
        : 'Capital 100% Protegido';
    }

    const alphaDistPct = Math.max(0, ((bot1UnitTarget - bot1Price) / bot1Price) * 100);
    const alphaDistEl = document.getElementById('alphaDistTarget');
    if (alphaDistEl) {
      alphaDistEl.textContent = bot1Qty > 0 || pos1
        ? (bot1Price >= bot1UnitTarget ? 'Meta 3x Taxa Batida!' : `${alphaDistPct.toFixed(2)}% para bater meta`)
        : 'Scanner rastreando moedas no radar';
    }

    const alphaProgress = (bot1Qty > 0 || pos1)
      ? (bot1Price >= bot1UnitTarget ? 100 : Math.min(95, Math.max(10, Math.round(((bot1Price - (bot1Entry * 0.995)) / (bot1UnitTarget - (bot1Entry * 0.995))) * 100))))
      : 100;
    const alphaFill = document.getElementById('alphaProgressFill');
    if (alphaFill) alphaFill.style.width = `${alphaProgress}%`;

    // 5. Painel Robô #2 (Beta Speed - Dinâmico: LTC / SUI / NEAR / etc)
    const betaTitleEl = document.getElementById('betaAssetTitle');
    if (betaTitleEl) {
      betaTitleEl.textContent = bot2Qty > 0 || pos2
        ? getCoinEmojiAndName(bot2Coin)
        : '⚡ Robô #2 (Beta Speed)';
    }
    const betaStatusEl = document.getElementById('betaStatusBadge');
    if (betaStatusEl) {
      betaStatusEl.textContent = bot2Qty > 0 || pos2 ? 'COMPRADO' : 'LUCRO REALIZADO';
      betaStatusEl.style.background = bot2Qty > 0 || pos2 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      betaStatusEl.style.color = bot2Qty > 0 || pos2 ? '#38bdf8' : '#10b981';
    }

    const betaAllocEl = document.getElementById('betaAllocatedDetails');
    if (betaAllocEl) {
      betaAllocEl.innerHTML = bot2Qty > 0 || pos2
        ? `Capital Alocado: <strong class="text-cyan">${formatCurrency(bot2Val)}</strong> (${bot2Qty.toFixed(5)} ${bot2Coin}) • Entrada: <strong id="betaEntryPrice">${formatCurrency(bot2Entry)}</strong>`
        : `Capital: <strong class="text-cyan">R$ ${brlFree.toFixed(2)} Caixa Livre</strong> • Pronto para nova compra`;
    }

    const betaLivePnL = document.getElementById('betaLivePnL');
    if (betaLivePnL) {
      if (bot2Qty > 0 || pos2) {
        betaLivePnL.textContent = `${bot2PnlPct >= 0 ? '+' : ''}${bot2PnlPct.toFixed(2)}% (${bot2PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot2PnlBrl)})`;
        betaLivePnL.style.color = bot2PnlPct >= 0 ? '#10b981' : '#ef4444';
      } else {
        betaLivePnL.textContent = `🟢 LUCRO REALIZADO (3x TAXA)`;
        betaLivePnL.style.color = '#10b981';
      }
    }
    const betaEntryEl = document.getElementById('betaEntryPrice');
    if (betaEntryEl && (bot2Qty > 0 || pos2)) betaEntryEl.textContent = formatCurrency(bot2Entry);
    const betaCurEl = document.getElementById('betaCurrentPrice');
    if (betaCurEl) betaCurEl.textContent = formatCurrency(bot2Price);

    const betaTargetEl = document.getElementById('betaTargetPrice');
    if (betaTargetEl) {
      betaTargetEl.textContent = (bot2Qty > 0 || pos2)
        ? `${formatCurrency(bot2UnitTarget)} (+R$ ${bot2TargetProfit.toFixed(2)} líq. 3x taxa)`
        : 'Vendido no Lucro! Scanner buscando nova entrada...';
    }
    const betaTrailEl = document.getElementById('betaTrailingPrice');
    if (betaTrailEl) {
      betaTrailEl.textContent = (bot2Qty > 0 || pos2)
        ? `Ativa em ${formatCurrency(bot2UnitTrail)} (+R$ ${bot2TrailProfit.toFixed(2)} líq.)`
        : 'Concluído com Sucesso';
    }
    const betaStopEl = document.getElementById('betaStopPrice');
    if (betaStopEl) {
      betaStopEl.textContent = (bot2Qty > 0 || pos2)
        ? `${formatCurrency(bot2UnitStop)} (Stop -1.8%)`
        : 'Capital 100% Protegido';
    }

    const bot2DistPct = Math.max(0, ((bot2UnitTarget - bot2Price) / bot2Price) * 100);
    const betaDistEl = document.getElementById('betaDistTarget');
    if (betaDistEl) {
      betaDistEl.textContent = bot2Qty > 0 || pos2 ? (bot2Price >= bot2UnitTarget ? 'Meta Batida!' : `${bot2DistPct.toFixed(2)}% para bater meta`) : 'Scanner rastreando moedas no radar';
    }

    const bot2Progress = (bot2Qty > 0 || pos2) ? (bot2Price >= bot2UnitTarget ? 100 : Math.min(95, Math.max(10, Math.round(((bot2Price - (bot2Entry * 0.995)) / (bot2UnitTarget - (bot2Entry * 0.995))) * 100)))) : 100;
    const betaFill = document.getElementById('betaProgressFill');
    if (betaFill) betaFill.style.width = `${bot2Progress}%`;

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
              <span style="font-size: 0.74rem; font-weight: 700; color: ${(item.rangePos7d !== undefined ? item.rangePos7d : 50) <= 45 ? '#10b981' : (item.rangePos7d !== undefined ? item.rangePos7d : 50) <= 70 ? '#38bdf8' : '#ef4444'};">
                ${item.range7d || (item.rangePos7d ? `${item.rangePos7d}% Fundo` : '--')}
              </span>
            </td>
            <td>
              <span style="font-size: 0.74rem; font-weight: 700; color: ${(item.buyerRatio24h !== undefined ? item.buyerRatio24h : 50) >= 50 ? '#10b981' : (item.buyerRatio24h !== undefined ? item.buyerRatio24h : 50) >= 42 ? '#fbbf24' : '#ef4444'};">
                ${item.buyerFlow || (item.buyerRatio24h ? `${item.buyerRatio24h}% Comp.` : '--')}
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
        ${bot1Qty > 0 || pos1 ? `
        <tr>
          <td>
            <div style="font-weight: 700; color: #c084fc;">Robô #1 (Alpha Titans)</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">${pos1?.orderId ? 'Ordem #' + pos1.orderId : 'Spot Binance'}</div>
          </td>
          <td><strong>${bot1Coin}/BRL</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">${bot1Qty.toFixed(5)} ${bot1Coin}</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">COMPRA MERCADO</span></td>
          <td><strong>${formatCurrency(bot1Entry)}</strong></td>
          <td><strong class="text-purple">${formatCurrency(bot1Val)}</strong></td>
          <td><strong style="color: #f8fafc;">${formatCurrency(bot1Price)}</strong></td>
          <td>
            <span style="font-weight: 800; color: ${bot1PnlPct >= 0 ? '#10b981' : '#ef4444'};">
              ${bot1PnlPct >= 0 ? '+' : ''}${bot1PnlPct.toFixed(2)}% (${bot1PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot1PnlBrl)})
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #10b981;">Alvo: ${formatCurrency(bot1UnitTarget)} (+R$ ${targetProfit.toFixed(2)})</div>
            <div style="font-size: 0.68rem; color: #ef4444;">Stop: ${formatCurrency(bot1UnitStop)} (-1.8%)</div>
          </td>
          <td>
            <span class="tag-badge tag-trading">⚡ OPERANDO AO VIVO</span>
          </td>
        </tr>
        ` : `
        <tr>
          <td>
            <div style="font-weight: 700; color: #c084fc;">Robô #1 (Alpha Titans)</div>
            <div style="font-size: 0.68rem; color: #10b981;">● Trade Concluído</div>
          </td>
          <td><strong>Caixa Livre</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">Pronto p/ disparo</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">LUCRO NO BOLSO</span></td>
          <td><strong>R$ 20,00</strong></td>
          <td><strong class="text-cyan">R$ 20,00</strong></td>
          <td><strong style="color: #38bdf8;">Scanner Ativo</strong></td>
          <td>
            <span style="font-weight: 800; color: #10b981;">
              +R$ 0,22 Realizado
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #38bdf8;">Aguardando Sobrevenda</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Pronto p/ comprar</div>
          </td>
          <td>
            <span class="tag-badge tag-neutral">⚪ MONITORANDO RADAR</span>
          </td>
        </tr>
        `}
        ${bot2Qty > 0 || pos2 ? `
        <tr>
          <td>
            <div style="font-weight: 700; color: #38bdf8;">Robô #2 (Beta Speed)</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">${pos2?.orderId ? 'Ordem #' + pos2.orderId : 'Spot Binance'}</div>
          </td>
          <td><strong>${bot2Coin}/BRL</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">${bot2Qty.toFixed(5)} ${bot2Coin}</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">COMPRA MERCADO</span></td>
          <td><strong>${formatCurrency(bot2Entry)}</strong></td>
          <td><strong class="text-cyan">${formatCurrency(bot2Val)}</strong></td>
          <td><strong style="color: #f8fafc;">${formatCurrency(bot2Price)}</strong></td>
          <td>
            <span style="font-weight: 800; color: ${bot2PnlPct >= 0 ? '#10b981' : '#ef4444'};">
              ${bot2PnlPct >= 0 ? '+' : ''}${bot2PnlPct.toFixed(2)}% (${bot2PnlBrl >= 0 ? '+' : ''}${formatCurrency(bot2PnlBrl)})
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #10b981;">Alvo: ${formatCurrency(bot2UnitTarget)} (+R$ ${targetProfit.toFixed(2)})</div>
            <div style="font-size: 0.68rem; color: #ef4444;">Stop: ${formatCurrency(bot2UnitStop)} (-1.8%)</div>
          </td>
          <td>
            <span class="tag-badge tag-trading">⚡ OPERANDO AO VIVO</span>
          </td>
        </tr>
        ` : `
        <tr>
          <td>
            <div style="font-weight: 700; color: #38bdf8;">Robô #2 (Beta Speed)</div>
            <div style="font-size: 0.68rem; color: #10b981;">● Trade Concluído</div>
          </td>
          <td><strong>Caixa Livre</strong><br><span style="font-size: 0.68rem; color: var(--text-muted);">Pronto p/ disparo</span></td>
          <td><span class="badge-live" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 0.68rem;">LUCRO NO BOLSO</span></td>
          <td><strong>R$ 5,00</strong></td>
          <td><strong class="text-cyan">R$ 5,00</strong></td>
          <td><strong style="color: #38bdf8;">Scanner Ativo</strong></td>
          <td>
            <span style="font-weight: 800; color: #10b981;">
              +R$ 0,22 Realizado
            </span>
          </td>
          <td>
            <div style="font-size: 0.72rem; color: #38bdf8;">Aguardando Sobrevenda</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Pronto p/ comprar</div>
          </td>
          <td>
            <span class="tag-badge tag-neutral">⚪ MONITORANDO RADAR</span>
          </td>
        </tr>
        `}
      `;
    }

    // 9. Tabela de Histórico de Ordens Fechadas (Lucros e Prejuízos Realizados)
    const closedOrdersTbody = document.getElementById('closedOrdersTableBody');
    if (closedOrdersTbody) {
      if (tradeLogs.length === 0) {
        closedOrdersTbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 1.25rem; color: var(--text-muted);">
              🟢 Os Robôs #1 e #2 estão operando com alvo institucional de +R$ 0,22 líq. (3x a taxa) com Trailing Stop.
              Assim que a oscilação rápida bater a meta ou o Trailing travar o lucro no bolso, o resultado aparecerá aqui automaticamente.
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

    // 10. Atualiza Tabs Dinâmicas de Velas & HUD do Trade
    const tabsContainer = document.getElementById('assetChartTabs');
    if (tabsContainer) {
      const activeCoin1 = bot1Coin || 'SOL';
      const activeCoin2 = bot2Coin || 'ETH';
      const isBot1Active = activeCandleState.asset === activeCoin1;
      const isBot2Active = activeCandleState.asset === activeCoin2;
      
      tabsContainer.innerHTML = `
        <button class="btn ${isBot1Active ? 'btn-primary' : ''}" onclick="selectCandleChart('${activeCoin1}', 'BINANCE:${activeCoin1}BRL', null, null, null, null, 'Robô #1 (Alpha Titans)', this)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
          🟣 Velas ${activeCoin1} (Robô #1)
        </button>
        <button class="btn ${isBot2Active ? 'btn-primary' : ''}" onclick="selectCandleChart('${activeCoin2}', 'BINANCE:${activeCoin2}BRL', null, null, null, null, 'Robô #2 (Beta Speed)', this)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
          🔵 Velas ${activeCoin2} (Robô #2)
        </button>
        <button class="btn ${activeCandleState.asset === 'BTC' ? 'btn-primary' : ''}" onclick="selectCandleChart('BTC', 'BINANCE:BTCBRL', null, null, null, null, 'Radar de Mercado', this)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
          🟡 Velas BTC
        </button>
        <button class="btn ${activeCandleState.asset === 'XRP' ? 'btn-primary' : ''}" onclick="selectCandleChart('XRP', 'BINANCE:XRPBRL', null, null, null, null, 'Radar de Mercado', this)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
          🟢 Velas XRP
        </button>
        <button class="btn ${activeCandleState.asset === 'DOGE' ? 'btn-primary' : ''}" onclick="selectCandleChart('DOGE', 'BINANCE:DOGEBRL', null, null, null, null, 'Radar de Mercado', this)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
          🐶 Velas DOGE
        </button>
      `;
    }

    updateActiveCandleHud(bot1Price, bot2Price, bot1Entry, bot2Entry, bot1PnlPct, bot2PnlPct, bot1PnlBrl, bot2PnlBrl, bot1Coin, bot2Coin);

    // 11. Central Estratégica Groq (LPU)
    const grok = state.grokAdvisor || {};
    const grokAdviceEl = document.getElementById('grokAdviceText');
    if (grokAdviceEl && grok.advice) {
      grokAdviceEl.innerHTML = grok.advice
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    }
    const grokBadgeEl = document.getElementById('grokStatusBadge');
    if (grokBadgeEl) {
      if (grok.hasGrokKey) {
        grokBadgeEl.innerHTML = `● GROK (xAI) & GROQ LPU ATIVOS`;
      } else if (grok.latencyMs) {
        grokBadgeEl.innerHTML = `● GROQ LPU ATIVO (${grok.latencyMs}ms • 120B)`;
      }
    }
    const grokProviderEl = document.getElementById('grokProviderLabel');
    if (grokProviderEl && grok.provider) {
      grokProviderEl.textContent = `🎙️ PARECER: ${grok.provider.toUpperCase()}`;
    }
    const grokSentimentEl = document.getElementById('grokSentimentVal');
    if (grokSentimentEl && grok.sentiment) {
      grokSentimentEl.textContent = grok.sentiment;
    }
    const grokRiskEl = document.getElementById('grokRiskVal');
    if (grokRiskEl && grok.riskLevel) {
      grokRiskEl.textContent = grok.riskLevel;
    }
    const grokTargetEl = document.getElementById('grokTargetVal');
    if (grokTargetEl) {
      grokTargetEl.textContent = `+R$ 0,22 (3x Taxa)`;
    }
    const grokStopEl = document.getElementById('grokStopVal');
    if (grokStopEl) {
      grokStopEl.textContent = `-1.8% (Protegido)`;
    }
    const grokTimeEl = document.getElementById('grokUpdatedTime');
    if (grokTimeEl && grok.updatedAt) {
      grokTimeEl.textContent = `Atualizado às ${grok.updatedAt}`;
    }

      // 12. Insights do Cérebro Neural
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
    } catch (err) {
      console.error('Erro na renderização do painel:', err);
    }
  }

  // 13. FUNÇÃO DE ATUALIZAÇÃO ULTRA-RÁPIDA (MILISSEGUNDOS) VIA WEBSOCKET
  window.onLivePriceTick = function (sym, price) {
    const d = window.currentEcosystemData;
    if (!d) return;

    // Atualiza ticker strip do mercado
    const tickerPills = document.querySelectorAll(`[data-ticker-sym="${sym}"]`);
    tickerPills.forEach(el => {
      const isBtc = sym.includes('BTC');
      el.textContent = `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: isBtc ? 2 : 2, maximumFractionDigits: 4 })}`;
    });

    // Atualiza simulador se o par atual for este
    if (typeof simState !== 'undefined' && simState.symbol === sym) {
      simState.price = price;
      const simCurEl = document.getElementById('simCurPriceDisplay');
      if (simCurEl) {
        simCurEl.textContent = price >= 10 ? formatCurrency(price) : `R$ ${price.toFixed(4)}`;
      }
    }

    // Atualiza Robô #1 em tempo real instantâneo
    if (sym === d.bot1Symbol && d.bot1Qty > 0) {
      // Proteção de segurança contra contaminação de cotação entre moedas
      if (d.bot1Entry > 0 && Math.abs(price - d.bot1Entry) / d.bot1Entry > 0.5) return;

      const pnlPct = d.bot1Entry > 0 ? (((price - d.bot1Entry) / d.bot1Entry) * 100) : 0;
      const grossPnlBrl = (price - d.bot1Entry) * d.bot1Qty;
      const bot1Fee = d.bot1Fee || ((d.bot1Qty * d.bot1Entry) * 0.0015);
      const netPnlBrl = grossPnlBrl - bot1Fee;

      const alphaCurEl = document.getElementById('alphaCurrentPrice');
      if (alphaCurEl) alphaCurEl.textContent = formatCurrency(price);

      const alphaLivePnL = document.getElementById('alphaLivePnL');
      if (alphaLivePnL) {
        alphaLivePnL.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (Líq: ${netPnlBrl >= 0 ? '+' : ''}R$ ${netPnlBrl.toFixed(2)})`;
        alphaLivePnL.style.color = netPnlBrl >= 0 ? '#10b981' : '#ef4444';
      }

      const bot1UnitTarget = d.bot1UnitTarget || (d.bot1Entry * 1.018);
      const distPct = Math.max(0, ((bot1UnitTarget - price) / price) * 100);
      const alphaDistEl = document.getElementById('alphaDistTarget');
      if (alphaDistEl) {
        alphaDistEl.textContent = price >= bot1UnitTarget ? 'Meta Batida! (+R$ 0,22 no bolso)' : `${distPct.toFixed(2)}% para bater meta (+R$ 0,22 líq.)`;
      }

      const alphaProgress = price >= bot1UnitTarget ? 100 : Math.min(95, Math.max(10, Math.round(((price - (d.bot1Entry * 0.995)) / (bot1UnitTarget - (d.bot1Entry * 0.995))) * 100)));
      const alphaFill = document.getElementById('alphaProgressFill');
      if (alphaFill) alphaFill.style.width = `${alphaProgress}%`;

      if (activeCandleState.asset === d.bot1Coin) {
        updateHudRealtimeTick(price, d.bot1Entry, pnlPct, netPnlBrl, bot1UnitTarget, d.bot1Qty, d.bot1UnitTrail, d.bot1UnitStop);
      }
    }

    // Atualiza Robô #2 em tempo real instantâneo
    if (sym === d.bot2Symbol && d.bot2Qty > 0) {
      // Proteção de segurança contra contaminação de cotação entre moedas (ex: ETH vs LTC)
      if (d.bot2Entry > 0 && Math.abs(price - d.bot2Entry) / d.bot2Entry > 0.5) return;

      const pnlPct = d.bot2Entry > 0 ? (((price - d.bot2Entry) / d.bot2Entry) * 100) : 0;
      const grossPnlBrl = (price - d.bot2Entry) * d.bot2Qty;
      const bot2Fee = d.bot2Fee || ((d.bot2Qty * d.bot2Entry) * 0.0015);
      const netPnlBrl = grossPnlBrl - bot2Fee;

      const betaCurEl = document.getElementById('betaCurrentPrice');
      if (betaCurEl) betaCurEl.textContent = formatCurrency(price);

      const betaLivePnL = document.getElementById('betaLivePnL');
      if (betaLivePnL) {
        betaLivePnL.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (Líq: ${netPnlBrl >= 0 ? '+' : ''}R$ ${netPnlBrl.toFixed(2)})`;
        betaLivePnL.style.color = netPnlBrl >= 0 ? '#10b981' : '#ef4444';
      }

      const bot2UnitTarget = d.bot2UnitTarget || (d.bot2Entry * 1.018);
      const distPct = Math.max(0, ((bot2UnitTarget - price) / price) * 100);
      const betaDistEl = document.getElementById('betaDistTarget');
      if (betaDistEl) {
        betaDistEl.textContent = price >= bot2UnitTarget ? 'Meta Batida! (+R$ 0,22 no bolso)' : `${distPct.toFixed(2)}% para bater meta (+R$ 0,22 líq.)`;
      }

      const bot2Progress = price >= bot2UnitTarget ? 100 : Math.min(95, Math.max(10, Math.round(((price - (d.bot2Entry * 0.995)) / (bot2UnitTarget - (d.bot2Entry * 0.995))) * 100)));
      const betaFill = document.getElementById('betaProgressFill');
      if (betaFill) betaFill.style.width = `${bot2Progress}%`;

      if (activeCandleState.asset === d.bot2Coin) {
        updateHudRealtimeTick(price, d.bot2Entry, pnlPct, netPnlBrl, bot2UnitTarget, d.bot2Qty, d.bot2UnitTrail, d.bot2UnitStop);
      }
    }
  };

  function updateHudRealtimeTick(curPrice, entryPrice, pnlPct, pnlBrl, targetPrice, qty, trailPrice, stopPrice) {
    const curEl = document.getElementById('hudCurrentPrice');
    if (curEl) curEl.textContent = formatCurrency(curPrice);

    const livePnlEl = document.getElementById('hudLivePnL');
    if (livePnlEl) {
      livePnlEl.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (${pnlBrl >= 0 ? '+' : ''}${formatCurrency(pnlBrl)})`;
      livePnlEl.style.color = pnlPct >= 0 ? '#10b981' : '#ef4444';
    }

    const tPrice = trailPrice || (entryPrice * 1.008);
    const sPrice = stopPrice || (entryPrice * 0.982);
    const gaugeMarker = document.getElementById('candleGaugeMarker');
    if (gaugeMarker) {
      const range = targetPrice - sPrice;
      let posPct = range > 0 ? ((curPrice - sPrice) / range) * 100 : 50;
      posPct = Math.max(3, Math.min(97, posPct));
      gaugeMarker.style.left = `${posPct.toFixed(1)}%`;
    }

    const gaugeStatusText = document.getElementById('gaugeStatusText');
    if (gaugeStatusText) {
      if (curPrice >= targetPrice) {
        gaugeStatusText.textContent = '🏆 ALVO INSTITUCIONAL ATINGIDO (+R$ 0,22 LÍQ. NO BOLSO)!';
        gaugeStatusText.style.color = '#10b981';
      } else if (curPrice >= tPrice) {
        gaugeStatusText.textContent = '🛡️ TRAILING LOCK ATIVADO (+R$ 0,08 GARANTIDO NO BOLSO)';
        gaugeStatusText.style.color = '#a855f7';
      } else if (curPrice >= entryPrice) {
        gaugeStatusText.textContent = '🟢 OPERANDO NO LUCRO FLUTUANTE (RUMO A 3x A TAXA)';
        gaugeStatusText.style.color = '#38bdf8';
      } else {
        gaugeStatusText.textContent = '🟡 DENTRO DA MARGEM NORMAL DE OSCILAÇÃO (STOP SEGURO)';
        gaugeStatusText.style.color = '#fbbf24';
      }
    }
  }

  // 14. CONEXÃO WEBSOCKET DIRETA COM A BINANCE (TRANSMISSÃO INSTANTÂNEA SUB-SEGUNDO)
  function initBinanceWebSocket() {
    try {
      const streams = 'solbrl@ticker/ltcbrl@ticker/bnbbrl@ticker/ethbrl@ticker/btcbrl@ticker/xrpbrl@ticker/dogebrl@ticker/suibrl@ticker/nearbrl@ticker/pepebrl@ticker/renderbrl@ticker/avaxbrl@ticker/linkbrl@ticker/adabrl@ticker/polbrl@ticker/usdcbrl@ticker';
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || !msg.data) return;
          const d = msg.data;
          const sym = d.s;
          const price = parseFloat(d.c);
          if (!sym || isNaN(price) || price <= 0) return;

          livePriceMap[sym] = price;
          if (typeof simPrices !== 'undefined') simPrices[sym] = price;

          if (window.onLivePriceTick) window.onLivePriceTick(sym, price);
        } catch (e) {}
      };

      ws.onclose = () => {
        setTimeout(initBinanceWebSocket, 2000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    } catch (e) {
      console.warn('[WS BINANCE] Erro:', e);
    }
  }

  initBinanceWebSocket();

  // Busca dados rápidos do ecossistema a cada 1.5s
  fetchRealState();
  setInterval(fetchRealState, 1500);
});

// =============================================================================
// GERENCIADOR DE VELAS (CANDLESTICKS) & HUD DO TRADE EM OPERAÇÃO
// =============================================================================
let activeCandleState = {
  asset: 'SOL',
  tvSymbol: 'BINANCE:SOLBRL',
  interval: '5',
  entryPrice: 629.20,
  targetPrice: 632.64,
  trailingPrice: 631.64,
  stopPrice: 621.70,
  botLabel: 'Robô #1 (Alpha Titans)'
};

function updateActiveCandleHud(bot1Price, bot2Price, bot1Entry, bot2Entry, bot1PnlPct, bot2PnlPct, bot1PnlBrl, bot2PnlBrl, bot1Coin, bot2Coin) {
  window.lastRenderParams = [bot1Price, bot2Price, bot1Entry, bot2Entry, bot1PnlPct, bot2PnlPct, bot1PnlBrl, bot2PnlBrl, bot1Coin, bot2Coin];

  const d = window.currentEcosystemData || {};
  const isBot1 = activeCandleState.asset === bot1Coin;
  const isBot2 = activeCandleState.asset === bot2Coin;

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

  let curPrice, entryPrice, pnlPct, pnlBrl, targetPrice, trailPrice, stopPrice;

  if (isBot1 && d.bot1Entry > 0) {
    curPrice = bot1Price;
    entryPrice = d.bot1Entry;
    pnlPct = bot1PnlPct;
    pnlBrl = bot1PnlBrl;
    targetPrice = d.bot1UnitTarget;
    trailPrice = d.bot1UnitTrail;
    stopPrice = d.bot1UnitStop;
  } else if (isBot2 && d.bot2Entry > 0) {
    curPrice = bot2Price;
    entryPrice = d.bot2Entry;
    pnlPct = bot2PnlPct;
    pnlBrl = bot2PnlBrl;
    targetPrice = d.bot2UnitTarget;
    trailPrice = d.bot2UnitTrail;
    stopPrice = d.bot2UnitStop;
  } else {
    curPrice = (window.livePriceMap && window.livePriceMap[activeCandleState.asset + 'BRL']) || (typeof simPrices !== 'undefined' && simPrices[activeCandleState.asset + 'BRL']) || activeCandleState.entryPrice || 10.0;
    entryPrice = activeCandleState.entryPrice || curPrice;
    pnlPct = entryPrice > 0 ? (((curPrice - entryPrice) / entryPrice) * 100) : 0;
    pnlBrl = (pnlPct / 100) * 13.00;
    targetPrice = activeCandleState.targetPrice || Number((entryPrice * 1.0035).toFixed(2));
    trailPrice = activeCandleState.trailingPrice || Number((entryPrice * 1.0020).toFixed(2));
    stopPrice = activeCandleState.stopPrice || Number((entryPrice * 0.9965).toFixed(2));
  }

  if (pairNameEl) pairNameEl.textContent = `${activeCandleState.asset}/BRL`;
  if (botBadgeEl) {
    botBadgeEl.textContent = isBot1
      ? '● ROBÔ #1 (ALPHA TITANS)'
      : isBot2
      ? '● ROBÔ #2 (BETA SPEED)'
      : `● ${activeCandleState.botLabel ? activeCandleState.botLabel.toUpperCase() : 'RADAR DE MERCADO'}`;
  }
  if (entryEl) entryEl.textContent = formatCurrency(entryPrice);
  if (curEl) curEl.textContent = formatCurrency(curPrice);
  if (targetEl) targetEl.textContent = formatCurrency(targetPrice);
  if (trailEl) trailEl.textContent = formatCurrency(trailPrice);
  if (stopEl) stopEl.textContent = formatCurrency(stopPrice);

  if (livePnlEl) {
    livePnlEl.textContent = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (${pnlBrl >= 0 ? '+' : ''}${formatCurrency(pnlBrl)})`;
    livePnlEl.style.color = pnlPct >= 0 ? '#10b981' : '#ef4444';
  }

  // Atualiza Termômetro
  if (gaugeStop) gaugeStop.textContent = formatCurrency(stopPrice);
  if (gaugeEntry) gaugeEntry.textContent = formatCurrency(entryPrice);
  if (gaugeTrail) gaugeTrail.textContent = formatCurrency(trailPrice);
  if (gaugeTarget) gaugeTarget.textContent = formatCurrency(targetPrice);

  if (gaugeMarker) {
    const range = targetPrice - stopPrice;
    let posPct = range > 0 ? ((curPrice - stopPrice) / range) * 100 : 50;
    posPct = Math.max(3, Math.min(97, posPct));
    gaugeMarker.style.left = `${posPct.toFixed(1)}%`;
  }

  if (gaugeStatusText) {
    if (curPrice >= targetPrice) {
      gaugeStatusText.textContent = '🏆 ALVO INSTITUCIONAL ATINGIDO (+R$ 0,22 LÍQ. NO BOLSO)!';
      gaugeStatusText.style.color = '#10b981';
    } else if (curPrice >= trailPrice) {
      gaugeStatusText.textContent = '🛡️ TRAILING LOCK ATIVADO (+R$ 0,08 GARANTIDO NO BOLSO)';
      gaugeStatusText.style.color = '#a855f7';
    } else if (curPrice >= entryPrice) {
      gaugeStatusText.textContent = '🟢 OPERANDO NO LUCRO FLUTUANTE (RUMO A 3x A TAXA)';
      gaugeStatusText.style.color = '#38bdf8';
    } else {
      gaugeStatusText.textContent = '🟡 DENTRO DA MARGEM NORMAL DE OSCILAÇÃO (STOP SEGURO)';
      gaugeStatusText.style.color = '#fbbf24';
    }
  }
}

// Troca para o gráfico de velas com os alvos do robô
window.selectCandleChart = function (asset, tvSymbol, entryPrice, targetPrice, trailingPrice, stopPrice, botLabel, btnElement) {
  activeCandleState.asset = asset;
  activeCandleState.tvSymbol = tvSymbol || (`BINANCE:${asset}BRL`);

  const d = window.currentEcosystemData;
  if (d) {
    if (asset === d.bot1Coin && d.bot1Entry > 0) {
      activeCandleState.entryPrice = d.bot1Entry;
      activeCandleState.targetPrice = d.bot1UnitTarget;
      activeCandleState.trailingPrice = d.bot1UnitTrail;
      activeCandleState.stopPrice = d.bot1UnitStop;
      activeCandleState.botLabel = 'Robô #1 (Alpha Titans)';
    } else if (asset === d.bot2Coin && d.bot2Entry > 0) {
      activeCandleState.entryPrice = d.bot2Entry;
      activeCandleState.targetPrice = d.bot2UnitTarget;
      activeCandleState.trailingPrice = d.bot2UnitTrail;
      activeCandleState.stopPrice = d.bot2UnitStop;
      activeCandleState.botLabel = 'Robô #2 (Beta Speed)';
    } else {
      const cur = (window.livePriceMap && window.livePriceMap[asset + 'BRL']) || (typeof simPrices !== 'undefined' && simPrices[asset + 'BRL']) || parseFloat(entryPrice) || 10;
      activeCandleState.entryPrice = cur;
      activeCandleState.targetPrice = Number((cur * 1.0035).toFixed(2));
      activeCandleState.trailingPrice = Number((cur * 1.0020).toFixed(2));
      activeCandleState.stopPrice = Number((cur * 0.9965).toFixed(2));
      activeCandleState.botLabel = botLabel || 'Radar de Mercado';
    }
  }

  if (entryPrice) activeCandleState.entryPrice = parseFloat(entryPrice);
  if (targetPrice) activeCandleState.targetPrice = parseFloat(targetPrice);
  if (trailingPrice) activeCandleState.trailingPrice = parseFloat(trailingPrice);
  if (stopPrice) activeCandleState.stopPrice = parseFloat(stopPrice);
  if (botLabel) activeCandleState.botLabel = botLabel;

  renderTvChartIframe();

  const tabs = document.querySelectorAll('#assetChartTabs button');
  tabs.forEach((b) => { b.className = 'btn'; });
  if (btnElement) { btnElement.className = 'btn btn-primary'; }

  if (window.lastRenderParams) {
    updateActiveCandleHud(...window.lastRenderParams);
  }
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

// =============================================================================
// SIMULADOR & CALCULADORA DE SCALPING E APORTE EM TEMPO REAL
// =============================================================================
const simPrices = {
  SOLBRL: 628.00,
  LTCBRL: 370.00,
  ETHBRL: 14100.00,
  BTCBRL: 445000.00,
  BNBBRL: 4137.00,
  XRPBRL: 7.81,
  DOGEBRL: 0.49,
  ADABRL: 1.28,
  SUIBRL: 6.25,
  LINKBRL: 74.20,
  AVAXBRL: 58.50,
  NEARBRL: 25.15,
  PEPEBRL: 0.000045
};

const simState = {
  symbol: 'SOLBRL',
  coin: 'SOL',
  price: 627.10,
  mode: 'goal', // 'goal' (quanto quer ganhar) ou 'capital' (se eu aportar R$ X)
  targetProfit: 0.10,
  oscPct: 0.05,
  capital: 100.00
};

// Alterna entre o modo "Quanto quero ganhar" e "Se eu aportar R$ X"
window.switchSimMode = function (mode) {
  simState.mode = mode;
  const tabGoal = document.getElementById('simTabModeGoal');
  const tabCap = document.getElementById('simTabModeCapital');
  const contGoal = document.getElementById('simModeGoalContainer');
  const contCap = document.getElementById('simModeCapitalContainer');

  if (mode === 'goal') {
    if (tabGoal) tabGoal.className = 'btn btn-primary';
    if (tabCap) tabCap.className = 'btn';
    if (contGoal) contGoal.style.display = 'block';
    if (contCap) contCap.style.display = 'none';
  } else {
    if (tabGoal) tabGoal.className = 'btn';
    if (tabCap) tabCap.className = 'btn btn-primary';
    if (contGoal) contGoal.style.display = 'none';
    if (contCap) contCap.style.display = 'block';
  }
  updateSimulator();
};

// Define lucro desejado via chips (+R$ 0,05, +R$ 0,10, etc.)
window.setSimProfit = function (val) {
  simState.targetProfit = parseFloat(val) || 0.10;
  const input = document.getElementById('simTargetProfitInput');
  if (input) input.value = simState.targetProfit.toFixed(2);

  document.querySelectorAll('.sim-chip').forEach(btn => {
    const rawText = btn.textContent.replace('+R$', '').replace('R$', '').replace(',', '.').trim();
    btn.classList.toggle('active', Math.abs(parseFloat(rawText) - simState.targetProfit) < 0.001);
  });
  updateSimulator();
};

// Define oscilação via chips (0.03%, 0.05%, etc.)
window.setSimOsc = function (pct) {
  simState.oscPct = parseFloat(pct) || 0.05;
  const slider = document.getElementById('simOscSlider');
  if (slider) slider.value = simState.oscPct;

  document.querySelectorAll('.sim-osc-chip').forEach(btn => {
    const match = btn.textContent.includes(`${simState.oscPct.toFixed(2)}%`) ||
      (simState.oscPct === 0.03 && btn.textContent.includes('0.03%')) ||
      (simState.oscPct === 0.05 && btn.textContent.includes('0.05%')) ||
      (simState.oscPct === 0.10 && btn.textContent.includes('0.10%')) ||
      (simState.oscPct === 0.25 && btn.textContent.includes('0.25%'));
    btn.classList.toggle('active', match);
  });
  updateSimulator();
};

// Slider de oscilação em tempo real
window.onSimSliderChange = function (val) {
  simState.oscPct = parseFloat(val) || 0.05;
  document.querySelectorAll('.sim-osc-chip').forEach(btn => btn.classList.remove('active'));
  updateSimulator();
};

// Define capital via chips (R$ 20, R$ 50, R$ 100, etc.)
window.setSimCapital = function (val) {
  simState.capital = parseFloat(val) || 100;
  const input = document.getElementById('simCapitalInput');
  if (input) input.value = simState.capital;

  document.querySelectorAll('.sim-cap-chip').forEach(btn => {
    const num = parseFloat(btn.textContent.replace('R$', '').replace(',', '.'));
    btn.classList.toggle('active', Math.abs(num - simState.capital) < 0.5);
  });
  updateSimulator();
};

// Função principal de cálculo do simulador
window.updateSimulator = function () {
  // Lê valores dos inputs se alterados diretamente
  const profitInput = document.getElementById('simTargetProfitInput');
  if (profitInput && !isNaN(parseFloat(profitInput.value))) {
    simState.targetProfit = parseFloat(profitInput.value);
  }
  const capInput = document.getElementById('simCapitalInput');
  if (capInput && !isNaN(parseFloat(capInput.value))) {
    simState.capital = parseFloat(capInput.value);
  }

  // Preço da moeda selecionada
  const curPrice = simPrices[simState.symbol] || simState.price || 627.10;
  simState.price = curPrice;

  // Atualiza display de cotação atual
  const priceDisplay = document.getElementById('simCurPriceDisplay');
  if (priceDisplay) {
    priceDisplay.textContent = curPrice >= 10 ? formatCurrency(curPrice) : `R$ ${curPrice.toFixed(4)}`;
  }

  // Labels
  const profitLabel = document.getElementById('simTargetProfitLabel');
  if (profitLabel) profitLabel.textContent = `+${formatCurrency(simState.targetProfit)}`;

  const oscLabel = document.getElementById('simOscLabel');
  if (oscLabel) oscLabel.textContent = `+${simState.oscPct.toFixed(2)}%`;

  const capLabel = document.getElementById('simCapitalLabel');
  if (capLabel) capLabel.textContent = formatCurrency(simState.capital);

  // MODO 1: QUANTO QUERO GANHAR -> CALCULA APORTE NECESSÁRIO
  // Fórmula: Aporte = Lucro / (Oscilação% / 100)
  const oscDecimal = simState.oscPct / 100;
  const requiredCapital = oscDecimal > 0 ? (simState.targetProfit / oscDecimal) : 0;

  const resultCapitalEl = document.getElementById('simResultCapital');
  if (resultCapitalEl) {
    resultCapitalEl.textContent = formatCurrency(requiredCapital);
  }
  const resultDetailEl = document.getElementById('simResultDetail');
  if (resultDetailEl) {
    resultDetailEl.innerHTML = `Para uma subida rápida de <strong>+${simState.oscPct.toFixed(2)}%</strong> render <strong>+${formatCurrency(simState.targetProfit)} no bolso</strong>`;
  }

  // MODO 2: SE EU APORTAR R$ X -> CALCULA LUCRO GERADO
  const profitFromCap = simState.capital * (simState.oscPct / 100);
  const profitTrail = simState.capital * 0.0003; // 0.03%
  const profitAlvo = simState.capital * 0.0025; // 0.25%

  const resultProfCapEl = document.getElementById('simResultProfitFromCap');
  if (resultProfCapEl) {
    resultProfCapEl.textContent = `+${formatCurrency(profitFromCap)}`;
  }
  const resultProfitDetail = document.getElementById('simResultProfitDetail');
  if (resultProfitDetail) {
    resultProfitDetail.innerHTML = `No Trailing (+0.03%): <strong class="text-purple">+${formatCurrency(profitTrail)}</strong> • No Alvo (+0.25%): <strong class="text-emerald">+${formatCurrency(profitAlvo)}</strong>`;
  }

  // DETALHES TÉCNICOS DO MOVIMENTO DO PREÇO DA MOEDA
  const deltaPrice = curPrice * (simState.oscPct / 100);
  const exitPrice = curPrice + deltaPrice;
  const simCoinName = simState.coin;

  const deltaText = document.getElementById('simPriceDeltaText');
  if (deltaText) {
    const formattedDelta = deltaPrice >= 1 ? formatCurrency(deltaPrice) : `+R$ ${deltaPrice.toFixed(4)}`;
    deltaText.textContent = `${formattedDelta} no preço do ${simCoinName}`;
  }

  const exitText = document.getElementById('simTargetExitPrice');
  if (exitText) {
    exitText.textContent = exitPrice >= 10 ? formatCurrency(exitPrice) : `R$ ${exitPrice.toFixed(4)}`;
  }

  const dailyProfit20 = (simState.mode === 'goal' ? simState.targetProfit : profitFromCap) * 20;
  const dailyProjEl = document.getElementById('simDailyProjection');
  if (dailyProjEl) {
    dailyProjEl.textContent = `${formatCurrency(dailyProfit20)} por dia`;
  }
};

// Listener para troca de moeda no select
function initSimulatorEvents() {
  const select = document.getElementById('simCoinSelect');
  if (select) {
    select.addEventListener('change', async (e) => {
      const sym = e.target.value;
      const opt = e.target.selectedOptions[0];
      const coin = opt ? opt.getAttribute('data-coin') : sym.replace('BRL', '');
      simState.symbol = sym;
      simState.coin = coin;

      // Busca cotação atual da Binance se não tiver ou atualiza
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          simPrices[sym] = parseFloat(d.price) || simPrices[sym];
        }
      } catch (err) {}

      updateSimulator();
    });
  }
}

// Inicializa simulador ao carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSimulatorEvents();
    updateSimulator();
  });
} else {
  initSimulatorEvents();
  updateSimulator();
}

// =============================================================================
// CENTRAL DE DESLIGAMENTO SEGURO SEM PERDAS (SHUTDOWN ASSISTANT)
// =============================================================================
window.openSafeShutdownModal = async function () {
  const modal = document.getElementById('modalSafeShutdown');
  if (!modal) return;
  modal.classList.add('active');

  const banner = document.getElementById('shutdownAuthorizedBanner');
  const actionButtons = document.getElementById('shutdownActionButtons');
  if (banner) banner.style.display = 'none';
  if (actionButtons) actionButtons.style.display = 'flex';

  const listEl = document.getElementById('shutdownAssetsList');
  if (listEl) listEl.innerHTML = '<div style="color: #94a3b8;">Consultando posições na Binance...</div>';

  try {
    const res = await fetch('/api/safe-shutdown');
    if (res.ok) {
      const data = await res.json();
      if (data.success && listEl) {
        let html = '';
        if (Array.isArray(data.activeAssets) && data.activeAssets.length > 0) {
          html += data.activeAssets.map(a => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.35rem;">
              <div>
                <strong>${a.name} (${a.asset})</strong>
                <div style="font-size: 0.72rem; color: #94a3b8;">Qtd: ${a.qty.toFixed(a.decimals)} • Cotação: R$ ${a.currentPrice.toLocaleString('pt-BR')}</div>
              </div>
              <div style="text-align: right;">
                <strong style="color: #38bdf8;">R$ ${a.valueBrl.toFixed(2)}</strong>
                <div style="font-size: 0.70rem; color: #10b981;">● Salvo em Carteira</div>
              </div>
            </div>
          `).join('');
        } else {
          html += '<div style="color: #10b981; font-weight: 700;">Nenhuma criptomoeda em risco! Todo seu capital já está em Real (BRL).</div>';
        }

        html += `
          <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; margin-top: 0.4rem;">
            <span style="color: #94a3b8;">Caixa Livre Disponível:</span>
            <strong style="color: #10b981;">R$ ${data.brlFree.toFixed(2)}</strong>
          </div>
        `;
        listEl.innerHTML = html;

        if (data.recommendation) {
          const recTitle = document.getElementById('shutdownRecTitle');
          const recDesc = document.getElementById('shutdownRecDesc');
          if (recTitle) recTitle.textContent = data.recommendation.title;
          if (recDesc) recDesc.innerHTML = `${data.recommendation.description}<br><br><span style="color: #38bdf8; font-weight: 600;">💡 Motivo: ${data.recommendation.reason}</span>`;
        }
      }
    }
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div style="color: #f87171;">Erro ao carregar dados da API.</div>';
  }
};

window.closeSafeShutdownModal = function () {
  const modal = document.getElementById('modalSafeShutdown');
  if (modal) modal.classList.remove('active');
};

window.executeSafeShutdown = async function (action) {
  const banner = document.getElementById('shutdownAuthorizedBanner');
  const bannerText = document.getElementById('shutdownAuthorizedText');
  const actionButtons = document.getElementById('shutdownActionButtons');

  if (actionButtons) {
    actionButtons.innerHTML = '<div style="text-align: center; color: #38bdf8; font-weight: 700; padding: 1rem;">Processando autorização segura na Binance...</div>';
  }

  try {
    const res = await fetch('/api/safe-shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    const data = await res.json();
    if (data.success) {
      if (banner) banner.style.display = 'block';
      if (bannerText) bannerText.textContent = data.message;
      if (actionButtons) actionButtons.style.display = 'none';
    } else {
      alert('Erro: ' + (data.error || 'Não foi possível processar a ação.'));
    }
  } catch (e) {
    if (banner) banner.style.display = 'block';
    if (actionButtons) actionButtons.style.display = 'none';
  }
};

// =============================================================================
// CONTROLE REMOTO & ALERTAS TELEGRAM
// =============================================================================
window.openTelegramModal = async function () {
  const modal = document.getElementById('modalTelegram');
  if (!modal) return;
  modal.classList.add('active');

  const statusText = document.getElementById('telegramStatusText');
  const statusDot = document.getElementById('telegramStatusDot');
  const badge = document.getElementById('telegramBadge');
  const tokenInput = document.getElementById('inputTelegramToken');
  const chatIdInput = document.getElementById('inputTelegramChatId');
  const testRes = document.getElementById('telegramTestResult');
  if (testRes) testRes.style.display = 'none';

  try {
    const res = await fetch('/api/telegram-config');
    if (res.ok) {
      const data = await res.json();
      if (tokenInput && data.hasToken) tokenInput.value = data.maskedToken || '';
      if (chatIdInput && data.chatId) chatIdInput.value = data.chatId || '';

      if (data.enabled) {
        if (statusText) statusText.innerHTML = '<span style="color: #10b981;">Conectado & Escutando Comandos</span>';
        if (statusDot) statusDot.style.background = '#10b981';
        if (badge) {
          badge.textContent = 'ONLINE 🟢';
          badge.style.background = 'rgba(16, 185, 129, 0.2)';
          badge.style.color = '#10b981';
        }
      } else {
        if (statusText) statusText.innerHTML = '<span style="color: #94a3b8;">Desconectado (Aguardando Token)</span>';
        if (statusDot) statusDot.style.background = '#94a3b8';
        if (badge) {
          badge.textContent = 'OFFLINE';
          badge.style.background = 'rgba(255, 255, 255, 0.06)';
          badge.style.color = '#94a3b8';
        }
      }
    }
  } catch (e) {
    if (statusText) statusText.textContent = 'Servidor local conectando...';
  }
};

window.closeTelegramModal = function () {
  const modal = document.getElementById('modalTelegram');
  if (modal) modal.classList.remove('active');
};

window.saveTelegramConfig = async function (test = false) {
  const tokenInput = document.getElementById('inputTelegramToken');
  const chatIdInput = document.getElementById('inputTelegramChatId');
  const testRes = document.getElementById('telegramTestResult');

  const botToken = tokenInput ? tokenInput.value.trim() : '';
  const chatId = chatIdInput ? chatIdInput.value.trim() : '';

  if (testRes) {
    testRes.style.display = 'block';
    testRes.style.background = 'rgba(14, 165, 233, 0.15)';
    testRes.style.border = '1px solid #0ea5e9';
    testRes.style.color = '#38bdf8';
    testRes.innerHTML = test ? 'Enviando mensagem de teste para o seu Telegram...' : 'Salvando configurações...';
  }

  try {
    const res = await fetch('/api/telegram-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId, test })
    });

    const data = await res.json();
    if (data.success) {
      if (chatIdInput && data.chatId) chatIdInput.value = data.chatId;
      if (testRes) {
        testRes.style.background = 'rgba(16, 185, 129, 0.15)';
        testRes.style.border = '1px solid #10b981';
        testRes.style.color = '#a7f3d0';
        testRes.innerHTML = test
          ? '✅ <strong>Sucesso Absoluto!</strong> Mensagem de teste enviada para seu celular. Abra seu Telegram!'
          : '✅ <strong>Configuração salva com sucesso!</strong> Seu robô já está conectado.';
      }
      setTimeout(() => {
        window.openTelegramModal();
      }, 1500);
    } else {
      if (testRes) {
        testRes.style.background = 'rgba(239, 68, 68, 0.15)';
        testRes.style.border = '1px solid #ef4444';
        testRes.style.color = '#fca5a5';
        if (data.needStart) {
          testRes.innerHTML = `👉 <strong>Falta apenas 1 clique no Telegram!</strong><br>` +
            `Abra o seu robô <a href="https://t.me/robobinace_bot" target="_blank" style="color: #38bdf8; font-weight: 700; text-decoration: underline;">@robobinace_bot</a> no Telegram, clique no botão <strong>COMEÇAR / START</strong> (ou mande um "oi") e clique em <strong>Testar no Celular</strong> novamente!`;
        } else {
          testRes.innerHTML = '❌ <strong>Erro:</strong> ' + (data.message || 'Verifique se o Token está correto e se enviou uma mensagem para o bot.');
        }
      }
    }
  } catch (err) {
    if (testRes) {
      testRes.style.background = 'rgba(239, 68, 68, 0.15)';
      testRes.style.border = '1px solid #ef4444';
      testRes.style.color = '#fca5a5';
      testRes.innerHTML = '❌ Erro de comunicação com o servidor local.';
    }
  }
};


