// scripts/comic/runpod/pod.mjs
// RunPod pod 제어 (status/stop/start) — REST API. 콘솔 없이 pod 를 켜고 끈다.
// 키: scripts/comic/runpod/.runpod-key (gitignored) 또는 env RUNPOD_API_KEY.
// pod id: --pod <id> · env RUNPOD_POD_ID · 또는 .runpod-pod 파일.
//
// Usage:
//   node scripts/comic/runpod/pod.mjs status [--pod <id>]
//   node scripts/comic/runpod/pod.mjs stop   [--pod <id>]
//   node scripts/comic/runpod/pod.mjs start  [--pod <id>]
import fs from "fs";
import path from "path";

const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const readMaybe = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };

const KEY = (process.env.RUNPOD_API_KEY || readMaybe(path.join(HERE, ".runpod-key"))).trim();
if (!KEY) { console.error("no RunPod key — set env RUNPOD_API_KEY or write scripts/comic/runpod/.runpod-key"); process.exit(3); }
const POD = String(arg("pod", process.env.RUNPOD_POD_ID || readMaybe(path.join(HERE, ".runpod-pod")))).trim();
if (!POD) { console.error("no pod id — pass --pod <id> or set RUNPOD_POD_ID / .runpod-pod"); process.exit(3); }
const action = (process.argv[2] || "status").toLowerCase();

const BASE = "https://rest.runpod.io/v1";
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function get() {
  const r = await fetch(`${BASE}/pods/${POD}`, { headers: H, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`GET pod ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function post(sub) {
  const r = await fetch(`${BASE}/pods/${POD}/${sub}`, { method: "POST", headers: H, signal: AbortSignal.timeout(30000) });
  if (!r.ok && r.status !== 200) throw new Error(`POST ${sub} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json().catch(() => ({}));
}
const line = (p) => `pod ${p.id} | desired=${p.desiredStatus} | ${p.machine?.gpuDisplayName || p.gpuCount + "×GPU"} | $${p.costPerHr}/h`;

try {
  if (action === "status") {
    console.log(line(await get()));
  } else if (action === "stop") {
    await post("stop");
    await new Promise((z) => setTimeout(z, 2500));
    console.log("stopped →", line(await get()));
  } else if (action === "start") {
    await post("start");
    await new Promise((z) => setTimeout(z, 2500));
    console.log("started →", line(await get()));
  } else {
    console.error(`unknown action "${action}" (status|stop|start)`); process.exit(2);
  }
} catch (e) { console.error("✗", e.message); process.exit(1); }
