// scripts/comic/preflight.mjs
// S0.5 — 생성 전(GPU 쓰기 전) text↔scene 정합 pre-flight (효율 게이트).
// 각 패널의 scene(그릴 그림)이 그 패널의 narration/caption(말할 내용)을 실제로 담는지 Claude가 검사.
// 캡션은 "썰매를 탔다"인데 scene 에 얼음이 없으면 → 생성해봐야 text_image_mismatch. 그걸 텍스트만으로 사전 차단.
//
// 1) 매니페스트:  node preflight.mjs --script S.json --out <dir> [--sdk]
//      → <dir>/preflight-manifest.json.  --sdk(+ANTHROPIC_API_KEY) 면 자동 채점까지.
//      아니면 Claude(에이전트)가 <dir>/preflight-verdicts.json 을 채운다.
// 2) 소비:  node preflight.mjs --verdicts <dir>  → 불합치 패널 목록, 있으면 exit 1(생성 차단).
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const RUBRIC = "각 패널의 scene 이 그 패널의 narration + captions 가 말하는 사건/사물/행동을 실제로 담는지 본다. 불합치 예: 캡션은 '얼음 위를 미끄러진다'인데 scene 은 수레를 민다; 캡션은 '투명하게 비친다'인데 scene 은 불투명; 캡션이 언급한 핵심 사물(안경, 사슬, 특정 배경)이 scene 에 없음. scene 이 캡션의 핵심을 담으면 coherent=true.";

const outDir = arg("out", arg("verdicts"));
if (!outDir) { console.error("--out <dir> 또는 --verdicts <dir> 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const vPath = path.join(outDir, "preflight-verdicts.json");

if (has("verdicts")) {
  if (!fs.existsSync(vPath)) { console.error(`no verdicts at ${vPath}`); process.exit(3); }
  const v = JSON.parse(fs.readFileSync(vPath, "utf8"));
  const rows = Object.entries(v).map(([n, r]) => ({ n: +n, ...r })).sort((a, b) => a.n - b.n);
  const bad = rows.filter((r) => r.coherent === false);
  for (const r of rows) console.log(`${r.coherent === false ? "✗" : "✓"} P${r.n}${r.coherent === false ? "  " + (r.issue || "") + "  → " + (r.fix || "") : ""}`);
  console.log(`\n${rows.length - bad.length}/${rows.length} coherent`);
  if (bad.length) { console.log(`BLOCK(생성 전 수정): P${bad.map((r) => r.n).join(",")} — scene/caption 정합 고치기`); process.exit(1); }
  console.log("PASS — text↔scene 정합. 생성 진행 가능."); process.exit(0);
}

const script = JSON.parse(fs.readFileSync(path.isAbsolute(arg("script")) ? arg("script") : path.join(process.cwd(), arg("script")), "utf8"));
const tier = script.adaptation?.default_tier || "teen";
const panels = (script.panels || []).map((p) => { const t = p.text?.[tier] || {}; return { n: p.n, scene: p.scene, narration: t.narration || "", captions: (t.bubbles || []).map((b) => (b.speaker ? b.speaker + ": " : "") + b.text) }; });
fs.writeFileSync(path.join(outDir, "preflight-manifest.json"), JSON.stringify({ rubric: RUBRIC, instruction: "각 패널을 판정해 preflight-verdicts.json 에 {panel:{coherent:bool, issue:'', fix:''}} 로 기록. coherent=false 는 생성을 막는다.", panels }, null, 2));
console.log(`preflight manifest → ${path.join(outDir, "preflight-manifest.json")} (${panels.length} panels)`);

if (has("sdk")) {
  let Anthropic; try { Anthropic = (await import("@anthropic-ai/sdk")).default; } catch { console.error("@anthropic-ai/sdk 미설치"); process.exit(4); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음"); process.exit(4); }
  const client = new Anthropic();
  const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 1500, messages: [{ role: "user", content: `${RUBRIC}\n\n패널들:\n${JSON.stringify(panels)}\n\n각 패널을 판정. ONLY 유효한 JSON: {"1":{"coherent":bool,"issue":"","fix":""}, ...} 전체 패널.` }] });
  const txt = msg.content.map((c) => c.text || "").join("");
  fs.writeFileSync(vPath, txt.match(/\{[\s\S]*\}/)[0]);
  console.log(`verdicts → ${vPath}`);
} else {
  console.log(`다음: Claude 에이전트가 매니페스트를 읽어 ${vPath} 작성 → node preflight.mjs --verdicts ${outDir}`);
}
