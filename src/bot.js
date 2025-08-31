import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf-8"));
const PROXIES_FILE = path.join(ROOT, "proxies.txt");

function readProxies() {
  if (!fs.existsSync(PROXIES_FILE)) {
    console.error("❌ proxies.txt tidak ditemukan!");
    process.exit(1);
  }
  return fs.readFileSync(PROXIES_FILE, "utf-8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));
}

function parseProxy(line) {
  let auth = null;
  let hostPort = line;
  if (line.includes("@")) {
    const [cred, hp] = line.split("@");
    const [username, password] = cred.split(":");
    hostPort = hp;
    auth = { username, password };
  }
  const [host, port] = hostPort.split(":");
  return { host, port, auth };
}

async function visitPage(browser, proxy, visitId) {
  const page = await browser.newPage();
  if (proxy.auth) await page.authenticate(proxy.auth);

  console.log(`▶️ Visit #${visitId} → ${config.targetUrl} via ${proxy.host}:${proxy.port}`);

  await page.goto(config.targetUrl, { waitUntil: "domcontentloaded" });

  // simulasi baca 1 menit
  const readTime = Math.floor(Math.random() * 
    (config.maxReadSeconds - config.minReadSeconds + 1)) + config.minReadSeconds;
  const scrolls = Math.floor(readTime * 1000 / config.scrollDelayMinMs);

  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(step => {
      window.scrollBy(0, step);
    }, config.scrollStep);
    await new Promise(r => setTimeout(r, 
      Math.floor(Math.random() * (config.scrollDelayMaxMs - config.scrollDelayMinMs)) + config.scrollDelayMinMs
    ));
  }

  console.log(`✅ Selesai Visit #${visitId} (dibaca ${readTime}s)`);
  await page.close();
}

(async () => {
  const proxies = readProxies();
  if (proxies.length < config.visits) {
    console.warn("⚠️ Proxy lebih sedikit dari jumlah visits, beberapa IP akan dipakai ulang");
  }

  for (let i = 0; i < config.visits; i++) {
    const proxyLine = proxies[i % proxies.length];
    const proxy = parseProxy(proxyLine);

    const browser = await puppeteer.launch({
      headless: config.headless,
      args: [`--proxy-server=${config.proxyProtocol}://${proxy.host}:${proxy.port}`]
    });

    try {
      await visitPage(browser, proxy, i + 1);
    } catch (err) {
      console.error(`❌ Error visit #${i + 1}:`, err.message);
    } finally {
      await browser.close();
    }
  }
})();
