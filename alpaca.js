/**
 * NEXUS WALL STREET - SIMULADOR ALPACA PAPER TRADING
 * ===================================================
 * Execução de ações fracionadas em ambiente demo.
 * Totalmente isolado da conta real da Binance.
 */

document.addEventListener('DOMContentLoaded', () => {
  const formatUSD = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  // 1. CARREGA DADOS DO LOCALSTORAGE DO NAVEGADOR
  let demoEquity = parseFloat(localStorage.getItem('alpaca_demo_equity')) || 100000.00;
  let demoOrders = JSON.parse(localStorage.getItem('alpaca_demo_orders') || '[]');

  function updateDemoUI() {
    const equityEl = document.getElementById('alpacaDemoEquity');
    if (equityEl) equityEl.textContent = formatUSD(demoEquity);

    const bpEl = document.getElementById('alpacaBuyingPower');
    if (bpEl) bpEl.textContent = formatUSD(demoEquity * 2);

    const pnlEl = document.getElementById('alpacaDemoPnL');
    if (pnlEl) {
      const pnl = demoEquity - 100000.00;
      const pnlPct = (pnl / 100000.00) * 100;
      const sign = pnl >= 0 ? '+' : '';
      pnlEl.textContent = `${sign}${formatUSD(pnl)} (${sign}${pnlPct.toFixed(2)}%)`;
      pnlEl.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
    }

    const countEl = document.getElementById('alpacaTradesCount');
    if (countEl) countEl.textContent = `${demoOrders.length} ordens simuladas executadas`;

    renderOrdersFeed();
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

    feed.innerHTML = demoOrders.slice(0, 8).map((ord) => `
      <div class="feed-item" style="border-left: 3px solid ${ord.side === 'buy' ? '#38bdf8' : '#a855f7'}; padding: 0.6rem 0.85rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.76rem;">
          <strong style="color: ${ord.side === 'buy' ? '#38bdf8' : '#a855f7'};">${ord.side === 'buy' ? '🟢 COMPRA SIMULADA' : '🔴 VENDA SIMULADA'} (${ord.symbol})</strong>
          <span style="color: var(--text-muted);">${ord.timestamp}</span>
        </div>
        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 0.25rem;">
          Valor: <strong>$ ${Number(ord.amount).toFixed(2)} USD</strong> • ID Paper: <strong style="color: #38bdf8;">#${ord.orderId}</strong>
        </div>
      </div>
    `).join('');
  }

  // 2. RELÓGIO DE WALL STREET (HORÁRIO DE NOVA YORK)
  function checkMarketHours() {
    const now = new Date();
    // Horário de Brasília (UTC-3) / Nova York (UTC-4)
    // Pregão americano: 10:30 às 17:00 (horário de Brasília nos dias úteis)
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
        statusText.textContent = 'WALL STREET: MERCADO FECHADO';
        statusText.style.color = '#38bdf8';
      }
    }
  }

  checkMarketHours();
  setInterval(checkMarketHours, 30000);

  // 3. EXECUÇÃO DE ORDEM SIMULADA (PAPER TRADING)
  const orderForm = document.getElementById('alpacaOrderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const symbol = document.getElementById('selectStock').value;
      const side = document.getElementById('selectOrderSide').value;
      const amount = parseFloat(document.getElementById('inputNotionalAmount').value) || 10;

      const savedKey = localStorage.getItem('alpaca_paper_key');
      const savedSecret = localStorage.getItem('alpaca_paper_secret');

      let orderId = 'PAPER-' + Math.random().toString(36).substring(2, 9).toUpperCase();

      // Se o usuário tiver cadastrado a chave da Alpaca, tenta enviar para a API real da Alpaca Paper:
      if (savedKey && savedSecret) {
        try {
          const res = await fetch('/api/alpaca-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: savedKey,
              apiSecret: savedSecret,
              symbol,
              side,
              notionalUsd: amount,
              isPaper: true
            })
          });
          const data = await res.json();
          if (data && data.data && data.data.id) {
            orderId = data.data.id.substring(0, 10);
          }
        } catch (apiErr) {
          console.warn('Simulação local acionada:', apiErr.message);
        }
      }

      // Atualiza saldo virtual
      if (side === 'buy') {
        demoEquity -= (amount * 0.001); // Simula micro-spread
      } else {
        demoEquity += (amount * 1.012); // Simula lucro hipotético
      }

      const newOrder = {
        orderId,
        symbol,
        side,
        amount,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      };

      demoOrders.unshift(newOrder);
      localStorage.setItem('alpaca_demo_equity', demoEquity.toFixed(2));
      localStorage.setItem('alpaca_demo_orders', JSON.stringify(demoOrders));

      updateDemoUI();
      alert(`🎉 Ordem Paper Trading enviada com sucesso!\n\nAtivo: ${symbol}\nOperação: ${side.toUpperCase()}\nValor: $${amount.toFixed(2)} USD\nID: #${orderId}\n\nSeu saldo real na Binance permanece 100% intocável.`);
    });
  }

  // 4. SALVAMENTO DE CHAVES DA ALPACA NO NAVEGADOR
  const keyForm = document.getElementById('alpacaKeyForm');
  if (keyForm) {
    const keyInput = document.getElementById('alpacaPaperKey');
    const secretInput = document.getElementById('alpacaPaperSecret');

    if (localStorage.getItem('alpaca_paper_key') && keyInput) {
      keyInput.value = localStorage.getItem('alpaca_paper_key');
    }

    keyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (keyInput.value) localStorage.setItem('alpaca_paper_key', keyInput.value.trim());
      if (secretInput.value) localStorage.setItem('alpaca_paper_secret', secretInput.value.trim());
      alert('✅ Chaves de Paper Trading da Alpaca salvas localmente no seu navegador!');
    });
  }

  updateDemoUI();
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
