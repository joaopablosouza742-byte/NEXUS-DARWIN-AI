const crypto = require("crypto");
const https = require("https");

const apiKey = process.env.BINANCE_API_KEY || 'r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB';
const apiSecret = process.env.BINANCE_API_SECRET || 'aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn';

function request(path, query = {}) {
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    const qs = Object.entries({ ...query, timestamp: ts })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const sig = crypto.createHmac("sha256", apiSecret).update(qs).digest("hex");
    const url = `https://api.binance.com${path}?${qs}&signature=${sig}`;
    https.get(url, { headers: { "X-MBX-APIKEY": apiKey } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on("error", reject);
  });
}

async function run() {
  const pairs = ["BNBBRL", "SOLBRL", "ETHBRL"];
  for (const s of pairs) {
    const orders = await request("/api/v3/allOrders", { symbol: s, limit: 3 });
    console.log(`=== ${s} Orders ===`);
    if (Array.isArray(orders)) {
      orders.forEach(o => console.log(`${o.side} ${o.symbol} status:${o.status} qty:${o.executedQty} quote:${o.cummulativeQuoteQty} price:${o.price} time:${new Date(o.time).toLocaleTimeString()}`));
    } else {
      console.log(orders);
    }
  }

  // Also check convert history
  const startTime = Date.now() - 24 * 60 * 60 * 1000;
  const convertHistory = await request("/sapi/v1/convert/tradeFlow", { startTime, endTime: Date.now(), limit: 5 });
  console.log(`=== Convert Trade Flow ===`);
  console.log(JSON.stringify(convertHistory, null, 2));
}
run();
