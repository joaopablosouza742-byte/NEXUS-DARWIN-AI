const fs = require('fs');
const https = require('https');

https.get('https://nexus-darwin-ai-default-rtdb.firebaseio.com/nexus_darwin_ecosystem.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const state = JSON.parse(data);
    
    // Simulate what app.js does with this state
    const balances = state.realBalances || {};
    const brlFree = parseFloat(balances.brlFree) || 20.58;
    const usdcTot = parseFloat(balances.usdcTotal) || 1.824;
    const usdcVal = parseFloat(balances.usdcBrlValue) || (usdcTot * 5.24);

    const activeBots = Array.isArray(state.activeBots) ? state.activeBots : [];
    const bot1 = activeBots[0] || {};
    const bot2 = activeBots[1] || {};

    const pos1 = bot1.openPosition;
    const pos2 = bot2.openPosition;

    console.log('Parsed successfully:');
    console.log('pos1:', pos1);
    console.log('pos2:', pos2);

    let grossPositive = 0;
    let grossNegative = 0;
    let countPos = 0;
    let countNeg = 0;

    const tradeLogs = Array.isArray(state.tradeLogs) ? state.tradeLogs : [];
    tradeLogs.forEach(t => {
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

    const netProfit = grossPositive - grossNegative;
    console.log('grossPositive:', grossPositive, 'countPos:', countPos);
    console.log('grossNegative:', grossNegative, 'countNeg:', countNeg);
    console.log('netProfit:', netProfit);

    // Bot 1
    const bot1Symbol = pos1?.symbol || 'SOLBRL';
    const bot1Coin = pos1?.baseAsset || 'SOL';
    console.log('Bot 1 Coin:', bot1Coin, 'Entry:', pos1?.entryPrice);

    // Bot 2
    const bot2Symbol = pos2?.symbol || 'ETHBRL';
    const bot2Coin = pos2?.baseAsset || 'ETH';
    console.log('Bot 2 Coin:', bot2Coin, 'Entry:', pos2?.entryPrice);
  });
});
