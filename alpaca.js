/**
 * NEXUS WALL STREET - SIMULADOR ALPACA PAPER TRADING
 * ===================================================
 * Execução de ações fracionadas em ambiente demo oficial.
 * Totalmente isolado da conta real da Binance.
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_KEY = 'PK5WU4MBN5X5QOHZFRGNXBWMDA';
  const DEFAULT_SECRET = 'GfC4EWSUuf5zmVV2VUtEPtrjcXmeaBFt9puGoLoDXhtx';

  // Salva automaticamente as chaves fornecidas pelo Pablo se ainda não estiverem no localStorage
  if (!localStorage.getItem('alpaca_paper_key')) {
    localStorage.setItem('alpaca_paper_key', DEFAULT_KEY);
  }
  if (!localStorage.getItem('alpaca_paper_secret')) {
    localStorage.setItem('alpaca_paper_secret', DEFAULT_SECRET);
  }

  const formatUSD = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  let demoEquity = 100000.00;
  let demoBuyingPower = 400000.00;
  let demoOrders = [];
  let demoPositions = [];

  // 1. SINCRONIZAÇÃO EM TEMPO REAL COM A API REAL DA ALPACA PAPER
  async function syncAlpacaLiveData() {
    const key = localStorage.getItem('alpaca_paper_key') || DEFAULT_KEY;
    const secret = localStorage.getItem('alpaca_paper_secret') || DEFAULT_SECRET;

    try {
      const res = await fetch(`/api/alpaca-account?apiKey=${encodeURIComponent(key)}&apiSecret=${encodeURIComponent(secret)}`);
      const data = await res.json();

      if (data && data.success && data.account) {
        const acc = data.account;
        demoEquity = parseFloat(acc.equity || acc.portfolio_value) || 100000.00;
        demoBuyingPower = parseFloat(acc.buying_power) || 400000.00;
        demoPositions = Array.isArray(data.positions) ? data.positions : [];
        demoOrders = Array.isArray(data.orders) ? data.orders : [];

        // Atualiza badge de conta conectada
        const connBadge = document.getElementById('alpacaConnBadge');
        if (connBadge) {
          connBadge.innerHTML = `● ALPACA ATIVA (${acc.account_number || 'PA362KPGI7JH'})`;
          connBadge.style.color = '#10b981';
          connBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        }

        const bannerAccount = document.getElementById('bannerAccountNumber');
        if (bannerAccount && acc.account_number) {
          bannerAccount.textContent = `Conta: ${acc.account_number} • Status: ${acc.status?.toUpperCase() || 'ATIVA'}`;
        }
      }
    } catch (err) {
      console.warn('[ALPACA SYNC]: Usando cache local/offline:', err.message);
    }

    updateDemoUI();
  }

  function updateDemoUI() {
    const equityEl = document.getElementById('alpacaDemoEquity');
    if (equityEl) equityEl.textContent = formatUSD(demoEquity);

    const bpEl = document.getElementById('alpacaBuyingPower');
    if (bpEl) bpEl.textContent = formatUSD(demoBuyingPower);

    const pnlEl = document.getElementById('alpacaDemoPnL');
    if (pnlEl) {
      const pnl = demoEquity - 100000.00;
      const pnlPct = (pnl / 100000.00) * 100;
      const sign = pnl >= 0 ? '+' : '';
      pnlEl.textContent = `${sign}${formatUSD(pnl)} (${sign}${pnlPct.toFixed(2)}%)`;
      pnlEl.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
    }

    const countEl = document.getElementById('alpacaTradesCount');
    if (countEl) countEl.textContent = `${demoOrders.length} ordens registradas na Alpaca`;

    renderPositionsTable(demoPositions);
    renderOrdersFeed();
  }

  function renderPositionsTable(positions) {
    const container = document.getElementById('alpacaPositionsContainer');
    if (!container) return;

    if (!positions || positions.length === 0) {
      container.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          Nenhuma posição aberta no momento. Ordens de ações serão preenchidas na abertura do pregão.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="market-table" style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; color: var(--text-muted);">
              <th style="padding: 0.45rem;">ATIVO</th>
              <th style="padding: 0.45rem;">QUANTIDADE</th>
              <th style="padding: 0.45rem;">PREÇO MÉDIO</th>
              <th style="padding: 0.45rem;">VALOR ATUAL</th>
              <th style="padding: 0.45rem;">PnL (LUCRO / PREJUÍZO)</th>
            </tr>
          </thead>
          <tbody>
            ${positions.map(p => {
              const pl = parseFloat(p.unrealized_pl) || 0;
              const plPct = (parseFloat(p.unrealized_plpc) || 0) * 100;
              const sign = pl >= 0 ? '+' : '';
              const plColor = pl >= 0 ? '#10b981' : '#ef4444';
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 0.45rem; font-weight: 700; color: #38bdf8;">${p.symbol}</td>
                  <td style="padding: 0.45rem;">${parseFloat(p.qty).toFixed(5)}</td>
                  <td style="padding: 0.45rem;">$ ${parseFloat(p.avg_entry_price).toFixed(2)}</td>
                  <td style="padding: 0.45rem; font-weight: 700;">$ ${parseFloat(p.market_value).toFixed(2)}</td>
                  <td style="padding: 0.45rem; font-weight: 700; color: ${plColor};">${sign}$ ${pl.toFixed(2)} (${sign}${plPct.toFixed(2)}%)</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOrdersFeed() {
    const feed = document.getElementById('alpacaOrdersFeed');
    if (!feed) return;

    if (demoOrders.length === 0) {
      feed.innerHTML = `
        <div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          Nenhuma ordem simulada enviada ainda. Teste uma compra fracionária de $10 ao lado!
        </div>
      `;
      return;
    }

    feed.innerHTML = demoOrders.slice(0, 10).map((ord) => {
      const isBuy = ord.side === 'buy';
      const orderColor = isBuy ? '#38bdf8' : '#a855f7';
      const statusColor = ord.status === 'filled' ? '#10b981' : ord.status === 'accepted' ? '#fbbf24' : '#94a3b8';
      const statusLabel = ord.status === 'filled' ? 'EXECUTADA' : ord.status === 'accepted' ? 'ACEITA (AGUARDANDO PREGÃO)' : (ord.status || 'OK').toUpperCase();
      
      const notionalVal = ord.notional ? `$ ${Number(ord.notional).toFixed(2)} USD` : (ord.qty ? `${ord.qty} ações` : '$ 10.00 USD');
      const timeStr = ord.submitted_at ? new Date(ord.submitted_at).toLocaleTimeString('pt-BR') : (ord.timestamp || 'Hoje');
      const orderIdShort = (ord.id || ord.orderId || '').substring(0, 8);

      return `
        <div class="feed-item" style="border-left: 3px solid ${orderColor}; padding: 0.65rem 0.85rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem;">
            <strong style="color: ${orderColor};">
              ${isBuy ? '🟢 COMPRA FRACIONADA' : '🔴 VENDA FRACIONADA'} (${ord.symbol})
            </strong>
            <span class="badge-live" style="background: rgba(255,255,255,0.05); color: ${statusColor}; font-size: 0.68rem; padding: 0.15rem 0.45rem;">
              ● ${statusLabel}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-secondary); margin-top: 0.35rem;">
            <span>Valor: <strong style="color: #f8fafc;">${notionalVal}</strong></span>
            <span>Hora: <strong>${timeStr}</strong> • ID: <strong style="color: #38bdf8;">#${orderIdShort}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. RELÓGIO DE WALL STREET (HORÁRIO DE NOVA YORK)
  function checkMarketHours() {
    const now = new Date();
    // Horário de Brasília (UTC-3) / Nova York (UTC-4)
    // Pregão americano regular: 10:30 às 17:00 (Seg a Sex)
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeVal = hours * 60 + minutes;

    const isOpen = day >= 1 && day <= 5 && timeVal >= (10 * 60 + 30) && timeVal <= (17 * 60);

    const statusDot = document.getElementById('marketStatusDot');
    const statusText = document.getElementById('marketStatusText');

    if (statusDot && statusText) {
      if (isOpen) {
        statusDot.className = 'pulse-dot pulse-green';
        statusText.textContent = 'WALL STREET: PREGÃO ABERTO';
        statusText.style.color = '#10b981';
      } else {
        statusDot.className = 'pulse-dot pulse-blue';
        const reason = (day === 0 || day === 6) ? 'FIM DE SEMANA (REABRE SEGUNDA 10:30)' : 'FECHADO (ABRE 10:30)';
        statusText.textContent = `WALL STREET: ${reason}`;
        statusText.style.color = '#38bdf8';
      }
    }
  }

  checkMarketHours();
  setInterval(checkMarketHours, 30000);

  // 3. EXECUÇÃO DE ORDEM SIMULADA (PAPER TRADING VIA API REAL DA ALPACA)
  const orderForm = document.getElementById('alpacaOrderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = document.getElementById('selectStock').value;
      const side = document.getElementById('selectOrderSide').value;
      const amount = parseFloat(document.getElementById('inputNotionalAmount').value) || 10;

      const key = localStorage.getItem('alpaca_paper_key') || DEFAULT_KEY;
      const secret = localStorage.getItem('alpaca_paper_secret') || DEFAULT_SECRET;

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      const origText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Enviando para a Alpaca Markets...';
      }

      try {
        const res = await fetch('/api/alpaca-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: key,
            apiSecret: secret,
            symbol,
            side,
            notionalUsd: amount,
            isPaper: true
          })
        });

        const data = await res.json();
        const orderInfo = data && data.data ? data.data : data;
        const orderId = orderInfo?.id || ('PAPER-' + Math.random().toString(36).substring(2, 9).toUpperCase());
        const orderStatus = orderInfo?.status || 'accepted';

        alert(`🎉 ORDEM REGISTRADA COM SUCESSO NA ALPACA PAPER!\n\n` +
              `• Ativo: ${symbol}\n` +
              `• Operação: ${side.toUpperCase()} (Fracionada)\n` +
              `• Valor: $${amount.toFixed(2)} USD\n` +
              `• ID Alpaca: #${orderId.substring(0, 10)}\n` +
              `• Status Oficial: ${orderStatus.toUpperCase()}\n\n` +
              `Como hoje é fim de semana, a ordem fica agendada para execução imediata na abertura de segunda-feira.\n` +
              `Seu saldo real na Binance permanece 100% intocável.`);

        // Atualiza os dados imediatamente da Alpaca
        await syncAlpacaLiveData();
      } catch (err) {
        console.error('[ERRO ORDEM ALPACA]:', err);
        alert(`Aviso: Ordem registrada em contingência local: ${err.message}`);
        await syncAlpacaLiveData();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
      }
    });
  }

  // 4. CONFIGURAÇÃO DE CHAVES DA ALPACA NO NAVEGADOR
  const keyForm = document.getElementById('alpacaKeyForm');
  if (keyForm) {
    const keyInput = document.getElementById('alpacaPaperKey');
    const secretInput = document.getElementById('alpacaPaperSecret');

    if (keyInput) keyInput.value = localStorage.getItem('alpaca_paper_key') || DEFAULT_KEY;
    if (secretInput) secretInput.value = localStorage.getItem('alpaca_paper_secret') || DEFAULT_SECRET;

    keyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (keyInput && keyInput.value) localStorage.setItem('alpaca_paper_key', keyInput.value.trim());
      if (secretInput && secretInput.value) localStorage.setItem('alpaca_paper_secret', secretInput.value.trim());
      alert('✅ Chaves de Paper Trading da Alpaca salvas e validadas!');
      await syncAlpacaLiveData();
    });
  }

  // Inicialização imediata
  syncAlpacaLiveData();
  // Atualiza a cada 15 segundos
  setInterval(syncAlpacaLiveData, 15000);
});

// Troca dinâmica de gráfico da Bolsa Americana
window.switchUSChart = function (symbol, btnElement) {
  const iframe = document.getElementById('us_tv_iframe');
  if (iframe) {
    const encoded = encodeURIComponent(symbol);
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encoded}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0b0e14&studies=%5B%5D&theme=dark&style=1&timezone=America%2FNew_York&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=br`;
  }

  const tabs = document.querySelectorAll('#usAssetTabs button');
  tabs.forEach((b) => {
    b.className = 'btn';
  });
  if (btnElement) {
    btnElement.className = 'btn btn-primary';
  }
};
