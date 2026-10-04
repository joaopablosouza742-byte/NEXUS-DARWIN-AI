const https = require("https");
https.get("https://nexus-darwin-ai-default-rtdb.firebaseio.com/nexus_darwin_ecosystem/tradeLogs.json", res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    try {
      const logs = JSON.parse(d);
      console.log("=== ALL TRADE LOGS IN FIREBASE ===");
      console.log(JSON.stringify(logs, null, 2));
    } catch(e) {
      console.error(e, d);
    }
  });
});
