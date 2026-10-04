const crypto = require("crypto");
const https = require("https");

const apiKey = "r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB";
const apiSecret = "aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn";

function req(path, q = {}) {
  return new Promise((res, rej) => {
    q.timestamp = Date.now();
    const qs = Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&");
    const sig = crypto.createHmac("sha256", apiSecret).update(qs).digest("hex");
    https.get("https://api.binance.com" + path + "?" + qs + "&signature=" + sig, { headers: { "X-MBX-APIKEY": apiKey } }, r => {
      let d = ""; r.on("data", c => d += c);
      r.on("end", () => {
        try { res(JSON.parse(d)); } catch(e) { res(d); }
      });
    }).on("error", rej);
  });
}

async function run() {
  const acc = await req("/api/v3/account");
  console.log("=== SALDOS REAIS NA BINANCE ===");
  console.log(acc.balances ? acc.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) : acc);

  const solOrders = await req("/api/v3/allOrders", { symbol: "SOLBRL", limit: 6 });
  console.log("=== TODAS AS ORDENS DE SOLBRL ===");
  if (Array.isArray(solOrders)) {
    solOrders.forEach(o => console.log(o.orderId, o.side, o.status, "qty:", o.executedQty, "quote:", o.cummulativeQuoteQty, "time:", new Date(o.time).toLocaleTimeString("pt-BR")));
  } else {
    console.log(solOrders);
  }

  const ethOrders = await req("/api/v3/allOrders", { symbol: "ETHBRL", limit: 5 });
  console.log("=== TODAS AS ORDENS DE ETHBRL ===");
  if (Array.isArray(ethOrders)) {
    ethOrders.forEach(o => console.log(o.orderId, o.side, o.status, "qty:", o.executedQty, "quote:", o.cummulativeQuoteQty, "time:", new Date(o.time).toLocaleTimeString("pt-BR")));
  } else {
    console.log(ethOrders);
  }
}
run();
