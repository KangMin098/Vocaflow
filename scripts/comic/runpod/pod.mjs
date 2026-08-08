// scripts/comic/runpod/pod.mjs
// RunPod pod 제어 (status/stop/start) — REST API. 콘솔 없이 pod 를 켜고 끈다.
// 키: scripts/comic/runpod/.runpod-key (gitignored) 또는 env RUNPOD_API_KEY.
// pod id: --pod <id> · env RUNPOD_POD_ID · 또는 .runpod-pod 파일.
//
// Usage:
//   node scripts/comic/runpod/pod.mjs list                 # 전체 pod(과금 없음)
//   node scripts/comic/runpod/pod.mjs status [--pod <id>]
//   node scripts/comic/runpod/pod.mjs start  [--pod <id>]   # 기동(과금) + .comfy-url 저장
//   node scripts/comic/runpod/pod.mjs url    [--pod <id>]   # 8188 프록시 URL → .comfy-url
//   node scripts/comic/runpod/pod.mjs stop   [--pod <id>]   # 정지(과금 중단)
import fs from "fs";
import path from "path";

const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const readMaybe = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };

const KEY = (process.env.RUNPOD_API_KEY || readMaybe(path.join(HERE, ".runpod-key"))).trim();
if (!KEY) { console.error("no RunPod key — set env RUNPOD_API_KEY or write scripts/comic/runpod/.runpod-key"); process.exit(3); }
const action = (process.argv[2] || "status").toLowerCase();

const BASE = "https://rest.runpod.io/v1";
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
// ComfyUI 프록시 URL 은 pod id 로 결정적: https://<id>-8188.proxy.runpod.net. 기동/조회 시 .comfy-url 로 저장해
// gen-comfy/gen-flux2 가 그대로 소비. ai-dock 포털 로그인(1111)은 gen-comfy 가 --user/--pass 로 처리.
const COMFY_URL_FILE = path.join(HERE, "..", ".comfy-url");
const comfyUrl = (id) => `https://${id}-8188.proxy.runpod.net`;
const saveComfyUrl = (id) => { const u = comfyUrl(id); fs.writeFileSync(COMFY_URL_FILE, u + "\n"); return u; };

// list: pod id 불필요 (전체 조회, read-only)
if (action === "list") {
  const r = await fetch(`${BASE}/pods`, { headers: H, signal: AbortSignal.timeout(25000) });
  if (!r.ok) { console.error(`list ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const raw = await r.json(); const pods = Array.isArray(raw) ? raw : (raw.pods || []);
  for (const p of pods) console.log(`${p.desiredStatus === "RUNNING" ? "▶" : "■"} ${p.id}  ${(p.name || "").padEnd(18)} ${p.desiredStatus.padEnd(8)} ${(p.machine?.gpuDisplayName || p.gpuCount + "×GPU")} $${p.costPerHr}/h  ${p.desiredStatus === "RUNNING" ? comfyUrl(p.id) : ""}`);
  console.log(`총 ${pods.length} pod${pods.some((p) => p.desiredStatus === "RUNNING") ? "" : " · RUNNING 없음(start 필요, 과금)"}`);
  process.exit(0);
}

const POD = String(arg("pod", process.env.RUNPOD_POD_ID || readMaybe(path.join(HERE, ".runpod-pod")))).trim();
if (!POD) { console.error("no pod id — pass --pod <id> or set RUNPOD_POD_ID / .runpod-pod"); process.exit(3); }

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
async function createPod(body) {
  const r = await fetch(`${BASE}/pods`, { method: "POST", headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`create ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}
async function del(id) { const r = await fetch(`${BASE}/pods/${id}`, { method: "DELETE", headers: H, signal: AbortSignal.timeout(30000) }); if (!r.ok && r.status !== 200) throw new Error(`delete ${r.status}: ${(await r.text()).slice(0, 200)}`); }
async function waitRunning(id, secs = 240) {
  for (let t = 0; t < secs; t += 8) { await new Promise((z) => setTimeout(z, 8000)); let p; try { p = await (await fetch(`${BASE}/pods/${id}`, { headers: H })).json(); } catch { continue; } process.stdout.write(`  ${p.desiredStatus}…`); if (p.desiredStatus === "RUNNING") { console.log(""); return p; } }
  return null;
}
// GPU 우선순위 (24GB 급) — --gpu "이름" 으로 단일 강제 가능
const GPUS = arg("gpu") ? [arg("gpu")] : ["NVIDIA GeForce RTX 4090", "NVIDIA RTX A5000", "NVIDIA GeForce RTX 3090", "NVIDIA L40S", "NVIDIA L4"];

try {
  if (action === "status") {
    console.log(line(await get()));
  } else if (action === "stop") {
    await post("stop"); await new Promise((z) => setTimeout(z, 2500)); console.log("stopped →", line(await get()));
  } else if (action === "start") {
    await post("start"); await new Promise((z) => setTimeout(z, 2500)); console.log("started →", line(await get()));
    const u = saveComfyUrl(POD); console.log(`ComfyUI URL → ${u}  (.comfy-url 저장 · 기동 30~90s 후 도달)`);
  } else if (action === "url") {
    const u = saveComfyUrl(POD); console.log(`${u}  (.comfy-url 저장)`);
  } else if (action === "wait") {
    const p = await waitRunning(POD); console.log(p ? "RUNNING → " + line(p) : "timeout(아직 RUNNING 아님)"); process.exit(p ? 0 : 1);
  } else if (action === "terminate") {
    await del(POD); console.log(`terminated ${POD}`);
  } else if (action === "new") {
    // 기존 pod 구성(네트워크볼륨·템플릿·디스크)을 상속해 다른 호스트에 새 pod 생성 (GPU 부족 폴백)
    const cur = await get();
    if (!cur.networkVolumeId) { console.error("현재 pod 에 networkVolumeId 없음 — 새 pod 에 모델 볼륨이 안 붙는다. 중단."); process.exit(1); }
    const body = { cloudType: "SECURE", gpuTypeIds: GPUS, gpuCount: 1, templateId: cur.templateId, networkVolumeId: cur.networkVolumeId, containerDiskInGb: cur.containerDiskInGb || 15, name: arg("name", "vocaflow-comic") };
    console.log(`creating pod on volume ${cur.networkVolumeId}, GPU priority: ${GPUS.join(" > ")}`);
    const np = await createPod(body);
    fs.writeFileSync(path.join(HERE, ".runpod-pod"), np.id);
    console.log(`✓ new pod ${np.id} (.runpod-pod 갱신) | 이전 pod ${POD} 은 필요없으면: node pod.mjs terminate --pod ${POD}`);
    const p = await waitRunning(np.id); console.log(p ? "RUNNING → " + line(p) : "생성됐으나 아직 RUNNING 대기 중 — node pod.mjs wait");
    process.exit(p ? 0 : 1);
  } else {
    console.error(`unknown action "${action}" (list|status|start|stop|wait|url|new|terminate)`); process.exit(2);
  }
} catch (e) { console.error("✗", e.message); process.exit(1); }
