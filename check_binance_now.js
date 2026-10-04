const crypto = require("crypto");
const https = require("https");

const apiKey = "r9h6DYtzeafyWkRn0rmtAsVj8VOhpRVywGHMteliFJrqg1ZdLpwGHZeJ78lDgJrB";
const apiSecret = "aI5l6ZmeOGsUwDRpr7yAbN3ITtNJTSfOkHnSuX5tPyTAHU88ppT3KXVVxpQjOKfn";

function req(path, qs = {}) {
  return new Promise((res, rej) => {
    const ts = Date.now();
    const q = Object.entries({ ...qs, timestamp: ts })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const sig = crypto.createHmac("sha256", apiSecret).update(q).digest("hex");
    https.get(`https://api.binance.com${path}?${q}&signature=${sig}`, { headers: { "X-MBX-APIKEY": apiKey } }, r => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => {
        try { res(JSON.parse(d)); } catch (e) { res(d); }
      });
    }).on("error", rej);
  });
}

async function run() {
  const acc = await req("/api/v3/account");
  const balances = acc.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  console.log("=== SPOT BALANCES ===");
  balances.forEach(b => console.log(`${b.asset}: Free=${b.free}, Locked=${b.locked}`));

  const earn = await req("/sapi/v1/simple-earn/flexible/position");
  console.log("=== EARN BALANCES ===");
  if (earn && earn.rows) {
    earn.rows.forEach(r => console.log(`${r.asset}: Total=${r.totalAmount}`));
  } else {
    console.log(earn);
  }
}
run();
