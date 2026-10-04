const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.BINANCE_API_KEY || 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const API_SECRET = process.env.BINANCE_API_SECRET || 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';

function bRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    params.timestamp = Date.now();
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const signature = crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex');
    const fullQs = `${qs}&signature=${signature}`;
    const opts = {
      hostname: 'api.binance.com',
      port: 443,
      path: `${path}?${fullQs}`,
      method: 'GET',
      headers: { 'X-MBX-APIKEY': API_KEY }
    };
    https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject).end();
  });
}

async function getTicker(symbol) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(parseFloat(JSON.parse(data).price)); } catch (e) { resolve(0); }
      });
    }).on('error', () => resolve(0));
  });
}

async function run() {
  const account = await bRequest('/api/v3/account');
  const balances = account.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  
  console.log('=== REAL BINANCE BALANCES ===');
  let totalBrl = 0;
  for (const b of balances) {
    const free = parseFloat(b.free);
    const locked = parseFloat(b.locked);
    const total = free + locked;
    let brlValue = 0;
    if (b.asset === 'BRL') {
      brlValue = total;
    } else if (b.asset === 'USDC' || b.asset === 'LDUSDC') {
      const usdtBrl = await getTicker('USDCBRL');
      brlValue = total * (usdtBrl || 5.25);
    } else {
      const p = await getTicker(b.asset + 'BRL');
      brlValue = total * p;
    }
    totalBrl += brlValue;
    console.log(`- ${b.asset}: Free=${b.free}, Locked=${b.locked} (~R$ ${brlValue.toFixed(2)})`);
  }
  console.log(`\n>>> TOTAL WALLET PATRIMONY: R$ ${totalBrl.toFixed(2)} <<<\n`);

  let totalFeesBrl = 0;
  for (const sym of ['SOLBRL', 'BNBBRL', 'ETHBRL', 'BTCBRL', 'XRPBRL', 'DOGEBRL']) {
    try {
      const trades = await bRequest('/api/v3/myTrades', { symbol: sym, limit: 15 });
      if (trades && trades.length > 0) {
        console.log(`=== RECENT TRADES FOR ${sym} (${trades.length} trades) ===`);
        trades.forEach(t => {
          const side = t.isBuyer ? 'COMPRA (BUY)' : 'VENDA (SELL)';
          const notional = (parseFloat(t.qty) * parseFloat(t.price)).toFixed(2);
          const fee = `${parseFloat(t.commission).toFixed(6)} ${t.commissionAsset}`;
          console.log(`  [${new Date(t.time).toLocaleString('pt-BR')}] ${side} Qtd: ${t.qty} @ R$ ${t.price} = R$ ${notional} | Taxa paga: ${fee}`);
        });
      }
    } catch (e) {}
  }
}
run().catch(console.error);
