const https = require('https');

https.get('https://api.binance.com/api/v3/exchangeInfo', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const info = JSON.parse(d);
    const symbols = ['BTCBRL', 'BTCUSDT', 'SOLBRL', 'SOLUSDT', 'BNBBRL', 'BNBUSDT'];
    symbols.forEach(sym => {
      const s = info.symbols.find(x => x.symbol === sym);
      if (s) {
        const notional = s.filters.find(f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL');
        console.log(`${s.symbol}: Min Notional = ${notional ? notional.minNotional : 'N/A'} (Quote: ${s.quoteAsset})`);
      }
    });
  });
});
