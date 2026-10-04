const https = require('https');

https.get('https://nexus-darwin-ai-default-rtdb.firebaseio.com/nexus_darwin_ecosystem.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const state = JSON.parse(data);
    console.log('=== ESTADO DO FIREBASE ===');
    console.log('TradeLogs length:', state.tradeLogs ? state.tradeLogs.length : 0);
    if (state.tradeLogs) {
      state.tradeLogs.forEach((t, i) => {
        console.log(`[${i+1}] ${t.timestamp} | ${t.action} | ${t.symbol} | Preço: R$ ${t.price} | Lucro: R$ ${t.profit !== undefined ? t.profit : '--'} | ID Binance: ${t.realOrderId}`);
      });
    }
    const b1 = state.activeBots ? state.activeBots[0] : null;
    const b2 = state.activeBots ? state.activeBots[1] : null;
    console.log('Robo 1:', b1 ? `${b1.name} | ${b1.assignedAsset} | Aberto: ${b1.openPosition ? b1.openPosition.symbol + ' Entrada R$ ' + b1.openPosition.entryPrice : 'NENHUMA (Caixa Livre)'}` : 'null');
    console.log('Robo 2:', b2 ? `${b2.name} | ${b2.assignedAsset} | Aberto: ${b2.openPosition ? b2.openPosition.symbol + ' Entrada R$ ' + b2.openPosition.entryPrice : 'NENHUMA (Caixa Livre)'}` : 'null');
  });
});
