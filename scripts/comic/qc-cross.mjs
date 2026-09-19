// scripts/comic/qc-cross.mjs
// S3 — 교차 일관성(T2): 같은 캐릭터가 여러 패널에서 동일 인물로 보이는지 Claude 가 묶어서 검사.
// (패널 단위 QC 는 개별 통과해도, Marley 가 15/17/18 에서 서로 다르게 보이는 것 같은 표류는 못 잡는다.)
//
// 1) 매니페스트:  node qc-cross.mjs --script S.json --images <dir> --out <qcdir> [--sdk]
//      → <qcdir>/cross-manifest.json (캐릭터 → 등장 패널 이미지 목록).
//      Claude(에이전트/--sdk)가 <qcdir>/cross-verdicts.json 작성.
// 2) 소비:  node qc-cross.mjs --verdicts <qcdir> → 불일치 캐릭터·재생성 대상 패널, exit 1 if any.
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const outDir = arg("out", arg("verdicts"));
if (!outDir) { console.error("--out 또는 --verdicts 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const vPath = path.join(outDir, "cross-verdicts.json");

if (has("verdicts")) {
  if (!fs.existsSync(vPath)) { console.error(`no verdicts at ${vPath}`); process.exit(3); }
  const v = JSON.parse(fs.readFileSync(vPath, "utf8"));
  const regen = new Set(); let bad = 0;
  for (const [c, r] of Object.entries(v)) {
    console.log(`${r.consistent === false ? "✗" : "✓"} ${c}${r.consistent === false ? "  " + (r.issue || "") + "  outliers: " + JSON.stringify(r.regen_panels || []) : ""}`);
    if (r.consistent === false) { bad++; (r.regen_panels || []).forEach((n) => regen.add(n)); }
  }
  console.log(`\n${Object.keys(v).length - bad}/${Object.keys(v).length} characters consistent`);
  if (regen.size) { console.log(`REGEN: --panels ${[...regen].sort((a, b) => a - b).join(",")}`); process.exit(1); }
  console.log("PASS — 교차 캐릭터 일관성 OK."); process.exit(0);
}

const script = JSON.parse(fs.readFileSync(path.isAbsolute(arg("script")) ? arg("script") : path.join(process.cwd(), arg("script")), "utf8"));
const imagesDir = arg("images");
const byId = Object.fromEntries((script.cast || []).map((c) => [c.id, c]));
const groups = {};
for (const p of script.panels || []) for (const id of p.characters || []) { (groups[id] ||= []).push({ n: p.n, image: path.join(imagesDir, `${String(p.n).padStart(2, "0")}.jpg`) }); }
const manifest = { instruction: "각 캐릭터의 등장 패널 이미지들을 나란히 보고, 같은 인물로 일관되는지 판정. anchor 와 대조. 특히 Scrooge(불투명·대머리) 와 Marley(반투명·턱붕대·돈사슬) 가 서로 안 섞이는지. cross-verdicts.json 에 {charId:{consistent:bool, issue:'', regen_panels:[가장 튀는 패널번호]}} 로.", characters: Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length >= 2).map(([id, v]) => [id, { anchor: byId[id]?.anchor, distinct_from: byId[id]?.distinct_from, panels: v }])) };
fs.writeFileSync(path.join(outDir, "cross-manifest.json"), JSON.stringify(manifest, null, 2));
const multi = Object.keys(manifest.characters);
console.log(`cross manifest → ${path.join(outDir, "cross-manifest.json")} (${multi.length} multi-panel chars: ${multi.join(",")})`);

if (has("sdk")) {
  let Anthropic; try { Anthropic = (await import("@anthropic-ai/sdk")).default; } catch { console.error("@anthropic-ai/sdk 미설치"); process.exit(4); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음"); process.exit(4); }
  const client = new Anthropic();
  const verdicts = {};
  for (const [id, g] of Object.entries(manifest.characters)) {
    const content = [{ type: "text", text: `캐릭터 "${id}" (${g.anchor}; ${g.distinct_from || ""}). 아래 패널 이미지들이 같은 인물로 일관되는지 판정. ONLY JSON: {"consistent":bool,"issue":"","regen_panels":[n,...]}` }];
    for (const pn of g.panels) { if (fs.existsSync(pn.image)) content.push({ type: "text", text: `panel ${pn.n}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(pn.image).toString("base64") } }); }
    const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 500, messages: [{ role: "user", content }] });
    const txt = msg.content.map((c) => c.text || "").join("");
    try { verdicts[id] = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]); } catch { verdicts[id] = { consistent: false, issue: "parse_error" }; }
    console.log(`${id}: ${verdicts[id].consistent ? "OK" : "DRIFT " + JSON.stringify(verdicts[id].regen_panels || [])}`);
  }
  fs.writeFileSync(vPath, JSON.stringify(verdicts, null, 2));
  console.log(`verdicts → ${vPath}`);
} else console.log(`다음: Claude 에이전트가 매니페스트 이미지들을 보고 ${vPath} 작성 → node qc-cross.mjs --verdicts ${outDir}`);
