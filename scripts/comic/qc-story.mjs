// scripts/comic/qc-story.mjs
// S4 — 내러티브/독자-경험 게이트: "결함·일관성"이 아니라 "이야기가 읽히고 재미있나"를 본다.
// 처음 읽는 학습자(+일반 독자)가 패널 순서대로 narration+대사를 읽었을 때 흐름이 이해되고
// 흥미로운지 Claude 가 판정. 기술 게이트(S2/S3/S3.5)가 원리상 못 보는 축(스토리 UX).
//
// 1) 매니페스트: node qc-story.mjs --staves "s1=examples/a.json:out/a,s2=examples/b.json:out/b" --out out/book/qc [--sdk]
//      (각 스테이지 = id=scriptPath:imageDir)  → story-manifest.json (순서대로 narration+대사+이미지)
//      Claude(에이전트/--sdk)가 story-verdicts.json 작성.
// 2) 소비: node qc-story.mjs --verdicts <out> → 이해도/재미 이슈 + 나레이션 수정 목록, 이슈 있으면 exit 1.
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const RUBRIC = "처음 읽는 학습자(한국 V7)+일반 독자로서 패널을 순서대로 읽는다. (A) 이해도: 무슨 일이 왜 일어나는지 따라가지나. 끊긴 장면전환·소개 없이 등장하는 인물·화자 불명·인과 공백·오해 소지를 찾는다(특히 나이변형 인물이 같은 사람임을 밝히나, 스테이지 간 연결되나). (B) 재미: 늘어지거나 밋밋한 패널, 안 통하는 농담·감정, 스테이지 끝의 다음 훅 유무. 예술 품질이 아니라 스토리만 판정. 수정은 대부분 narration 한 줄(아트 고정).";
const outDir = arg("out", arg("verdicts"));
if (!outDir) { console.error("--out 또는 --verdicts 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const vPath = path.join(outDir, "story-verdicts.json");

if (has("verdicts")) {
  if (!fs.existsSync(vPath)) { console.error(`no verdicts at ${vPath}`); process.exit(3); }
  const v = JSON.parse(fs.readFileSync(vPath, "utf8"));
  const comp = v.comprehension_issues || [], eng = v.engagement_issues || [];
  console.log("=== 이해도(comprehension) ===");
  comp.length ? comp.forEach((c) => console.log(`  ✗ ${c.stave} p${c.panel}: ${c.issue}\n     → ${c.fix || ""}`)) : console.log("  ✓ 흐름 명료");
  console.log("=== 재미(engagement) ===");
  eng.length ? eng.forEach((e) => console.log(`  ⚠ ${e.stave} p${e.panel}: ${e.issue}\n     → ${e.fix || ""}`)) : console.log("  ✓ 몰입 양호");
  if (v.scores) console.log("\n점수:", JSON.stringify(v.scores));
  const blockers = comp.length; // 이해도 이슈 = 배포 블로커, 재미 이슈 = 경고
  console.log(`\n이해도 이슈 ${comp.length} · 재미 이슈 ${eng.length}`);
  if (blockers) { console.log("BLOCK — 나레이션 수정 필요(이해 흐름)"); process.exit(1); }
  console.log("PASS — 이야기 흐름 이해 가능. (재미 이슈는 선택 개선)"); process.exit(0);
}

const staves = String(arg("staves", "")).split(",").filter(Boolean).map((s) => { const [id, rest] = s.split("="); const [script, dir] = rest.split(":"); return { id, script, dir }; });
if (!staves.length) { console.error('--staves "id=script:dir,..." 필요'); process.exit(2); }
const buildStave = (s) => {
  const j = JSON.parse(fs.readFileSync(path.isAbsolute(s.script) ? s.script : path.join(process.cwd(), s.script), "utf8"));
  const tier = j.adaptation?.default_tier || "teen";
  return { id: s.id, panels: (j.panels || []).map((p) => { const t = p.text?.[tier] || {}; return { panel: p.n, narration: t.narration || "", bubbles: (t.bubbles || []).map((b) => (b.speaker ? b.speaker + ": " : "") + b.text), image: path.join(s.dir, `${String(p.n).padStart(2, "0")}.jpg`) }; }) };
};
const manifest = { rubric: RUBRIC, instruction: "story-verdicts.json 에 {\"comprehension_issues\":[{\"stave\":id,\"panel\":n,\"issue\":\"\",\"fix\":\"narration 수정안\"}], \"engagement_issues\":[{...}], \"scores\":{\"comprehension\":0-10,\"engagement\":0-10,\"learner\":0-10}} 로. 이해도 이슈는 배포 블로커.", staves: staves.map(buildStave) };
fs.writeFileSync(path.join(outDir, "story-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`story manifest → ${path.join(outDir, "story-manifest.json")} (${manifest.staves.reduce((a, s) => a + s.panels.length, 0)} panels)`);

if (has("sdk")) {
  let Anthropic; try { Anthropic = (await import("@anthropic-ai/sdk")).default; } catch { console.error("@anthropic-ai/sdk 미설치"); process.exit(4); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음"); process.exit(4); }
  const client = new Anthropic();
  const content = [{ type: "text", text: `${RUBRIC}\n\n순서대로 읽어라(각 패널 텍스트+이미지). ONLY JSON per instruction.` }];
  for (const s of manifest.staves) for (const p of s.panels) { content.push({ type: "text", text: `[${s.id} p${p.panel}] NARR: ${p.narration} | ${p.bubbles.join(" / ")}` }); if (fs.existsSync(p.image)) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(p.image).toString("base64") } }); }
  const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 2500, messages: [{ role: "user", content }] });
  fs.writeFileSync(vPath, msg.content.map((c) => c.text || "").join("").match(/\{[\s\S]*\}/)[0]);
  console.log(`verdicts → ${vPath}`);
} else console.log(`다음: Claude 에이전트가 순서대로 읽고 ${vPath} 작성 → node qc-story.mjs --verdicts ${outDir}`);
