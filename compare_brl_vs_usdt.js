const https = require('https');
const crypto = require('crypto');

const API_KEY = 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const API_SECRET = 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';

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
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject).end();
  });
}

function getKlines(symbol, interval, startTime, endTime) {
  return new Promise((resolve, reject) => {
    const url = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=5`;
    https.get(`https://api.binance.com${url}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

async function runComparison() {
  console.log('=== COLETANDO ORDENS REAIS DO DIA (03/10/2026) ===\n');
  const symbols = ['SOLBRL', 'ETHBRL', 'BNBBRL', 'BTCBRL'];
  let allTrades = [];

  for (const s of symbols) {
    const trades = await bRequest('/api/v3/myTrades', { symbol: s, limit: 15 });
    if (Array.isArray(trades)) {
      trades.forEach(t => {
        // Apenas trades de hoje
        const date = new Date(t.time);
        if (date.getDate() === 3 && date.getMonth() === 9) { // Outubro (mês 9 no JS)
          allTrades.push({
            symbol: s,
            usdtSymbol: s.replace('BRL', 'USDT'),
            time: t.time,
            timeStr: date.toLocaleTimeString('pt-BR'),
            dateStr: date.toLocaleDateString('pt-BR'),
            isBuyer: t.isBuyer,
            side: t.isBuyer ? 'BUY' : 'SELL',
            price: parseFloat(t.price),
            qty: parseFloat(t.qty),
            costBrl: parseFloat(t.qty) * parseFloat(t.price),
            fee: parseFloat(t.commission),
            feeAsset: t.commissionAsset
          });
        }
      });
    }
  }

  // Ordena por horário
  allTrades.sort((a, b) => a.time - b.time);

  console.log(`Encontradas ${allTrades.length} operações reais executadas hoje.\n`);

  // Agrupa ciclos de compra e venda (Roundtrips)
  console.log('----------------------------------------------------------------------------------------------------------');
  console.log('COMPARAÇÃO HISTÓRICA MINUTO A MINUTO: BRL vs USDT');
  console.log('----------------------------------------------------------------------------------------------------------\n');

  for (let i = 0; i < allTrades.length; i++) {
    const t = allTrades[i];
    // Pega vela de 1 minuto na Binance para o par BRL e o par USDT no exato minuto da ordem
    const klinesBrl = await getKlines(t.symbol, '1m', t.time - 30000, t.time + 30000);
    const klinesUsdt = await getKlines(t.usdtSymbol, '1m', t.time - 30000, t.time + 30000);
    const klinesUsdtBrl = await getKlines('USDTBRL', '1m', t.time - 30000, t.time + 30000);

    const priceUsdt = klinesUsdt.length > 0 ? parseFloat(klinesUsdt[0][4]) : 0; // Preço de fechamento daquele minuto
    const rateUsdtBrl = klinesUsdtBrl.length > 0 ? parseFloat(klinesUsdtBrl[0][4]) : 5.25;

    t.priceUsdt = priceUsdt;
    t.rateUsdtBrl = rateUsdtBrl;
    t.costUsd = t.costBrl / rateUsdtBrl;

    console.log(`[${t.timeStr}] ${t.side} em ${t.symbol}:`);
    console.log(`   - Preço BRL: R$ ${t.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Volume: R$ ${t.costBrl.toFixed(2)}`);
    console.log(`   - Preço USDT: $ ${priceUsdt.toFixed(2)} (Taxa Câmbio USDT/BRL: R$ ${rateUsdtBrl.toFixed(3)}) | Volume: $ ${t.costUsd.toFixed(2)}`);
    console.log(`   - Viabilidade no Spot USDT: ${t.costUsd < 5.0 ? '❌ BLOQUEADO (Ordem abaixo do mínimo de 5 USDT = ~R$ 27,50)' : '✅ Permitido'}`);
    console.log('');
  }

  // Agora compara os ciclos fechados (COMPRA -> VENDA)
  console.log('==========================================================================================================');
  console.log('AUDITORIA DE RESULTADO DE CICLOS FECHADOS (LUCRO BRL vs LUCRO USDT):');
  console.log('==========================================================================================================\n');

  // Ciclo 1: SOL (Compra 12:03:18 -> Venda 14:13:36)
  // Ciclo 2: SOL (Compra 14:14:08 -> Venda 14:48:53)
  // Ciclo 3: ETH (Compra 11:47:31 -> Venda 14:30:54)

  const cycles = [
    {
      name: 'Ciclo SOL #1',
      asset: 'SOL',
      buyTime: 1791039798000, // 12:03:18
      sellTime: 1791047616000, // 14:13:36
      buyBrl: 626.80, sellBrl: 628.00,
      qty: 0.030,
      costBrl: 18.80
    },
    {
      name: 'Ciclo SOL #2',
      asset: 'SOL',
      buyTime: 1791047648000, // 14:14:08
      sellTime: 1791049733000, // 14:48:53
      buyBrl: 628.10, sellBrl: 628.20,
      qty: 0.031,
      costBrl: 19.47
    },
    {
      name: 'Ciclo ETH #1',
      asset: 'ETH',
      buyTime: 1791038851000, // 11:47:31
      sellTime: 1791048654000, // 14:30:54
      buyBrl: 14058.82, sellBrl: 14061.34,
      qty: 0.0013,
      costBrl: 18.28
    }
  ];

  for (const c of cycles) {
    const kBuyUsdt = await getKlines(`${c.asset}USDT`, '1m', c.buyTime - 30000, c.buyTime + 30000);
    const kSellUsdt = await getKlines(`${c.asset}USDT`, '1m', c.sellTime - 30000, c.sellTime + 30000);
    const kRateBuy = await getKlines('USDTBRL', '1m', c.buyTime - 30000, c.buyTime + 30000);
    const kRateSell = await getKlines('USDTBRL', '1m', c.sellTime - 30000, c.sellTime + 30000);

    const buyPriceUsdt = kBuyUsdt.length ? parseFloat(kBuyUsdt[0][4]) : 0;
    const sellPriceUsdt = kSellUsdt.length ? parseFloat(kSellUsdt[0][4]) : 0;
    const rateBuy = kRateBuy.length ? parseFloat(kRateBuy[0][4]) : 5.25;
    const rateSell = kRateSell.length ? parseFloat(kRateSell[0][4]) : 5.25;

    // Variação % BRL
    const pctBrl = ((c.sellBrl - c.buyBrl) / c.buyBrl) * 100;
    const pnlGrossBrl = (c.sellBrl - c.buyBrl) * c.qty;
    const feesBrl = c.costBrl * 0.0020;
    const pnlNetBrl = pnlGrossBrl - feesBrl;

    // Variação % USDT
    const pctUsdt = ((sellPriceUsdt - buyPriceUsdt) / buyPriceUsdt) * 100;
    const notionalUsd = c.costBrl / rateBuy;
    const pnlGrossUsd = notionalUsd * (pctUsdt / 100);
    const feesUsd = notionalUsd * 0.0020;
    const pnlNetUsd = pnlGrossUsd - feesUsd;
    const pnlNetUsdInBrl = pnlNetUsd * rateSell;

    console.log(`📊 [${c.name}]:`);
    console.log(`   Horários: Compra às ${new Date(c.buyTime).toLocaleTimeString('pt-BR')} | Venda às ${new Date(c.sellTime).toLocaleTimeString('pt-BR')}`);
    console.log(`   No Par /BRL:`);
    console.log(`      Entrada: R$ ${c.buyBrl.toFixed(2)} -> Saída: R$ ${c.sellBrl.toFixed(2)} (Oscilação: +${pctBrl.toFixed(3)}%)`);
    console.log(`      Lucro Bruto: +R$ ${pnlGrossBrl.toFixed(3)} | Taxas Binance: -R$ ${feesBrl.toFixed(3)} | Líquido Real: R$ ${pnlNetBrl.toFixed(3)}`);
    console.log(`   No Par /USDT:`);
    console.log(`      Entrada: $ ${buyPriceUsdt.toFixed(2)} -> Saída: $ ${sellPriceUsdt.toFixed(2)} (Oscilação: ${pctUsdt >= 0 ? '+' : ''}${pctUsdt.toFixed(3)}%)`);
    console.log(`      Lucro Bruto: $ ${pnlGrossUsd.toFixed(4)} | Taxas: -$ ${feesUsd.toFixed(4)} | Líquido: $ ${pnlNetUsd.toFixed(4)} (~R$ ${pnlNetUsdInBrl.toFixed(3)})`);
    console.log(`   ⚠️ Spread Cambial Dólar: Câmbio Compra R$ ${rateBuy.toFixed(4)} -> Câmbio Venda R$ ${rateSell.toFixed(4)} (${((rateSell-rateBuy)/rateBuy*100).toFixed(2)}%)`);
    console.log('----------------------------------------------------------------------------------------------------------\n');
  }
}

runComparison().catch(console.error);
