// scripts/comic/release-gate.mjs
// R24 전수 릴리스 게이트 = 책의 "모든 스테이브의 모든 패널"을 scene-match + 하드페일 루브릭으로
// 재검증하고, 커버리지를 강제한다. 스팟-교정한 일부만 재검증하는 것을 원리적으로 차단:
//   verdicts 에 스크립트의 어떤 패널이라도 빠지면 → UNINSPECTED → 무조건 HOLD.
// (2026-08-06 실측: 19패널만 고치고 근접-마감 판단 → 전수 게이트가 never-flagged 7 하드페일 발견.)
//
// 이 게이트의 SCOPE = 패널 1장(scene 정합 + 하드페일). 스타일 균일성·스테이지 연속성은 qc-book(S3.5)가 담당.
// 둘을 함께 통과해야 SHIP. release-gate 는 per-stave qc 를 오케스트레이션 + 책 단위로 집계한다.
//
// 1) 매니페스트:
//    node release-gate.mjs --staves "1=out/carol-adapted=scripts/comic/examples/carol-stave1.adapted.json,2=out/carol-stave2=..." --out out/book/regate [--sdk]
//      → <out>/stave-<id>-manifest.json (스테이브별 전 패널 + scene + captions + 하드페일 루브릭)
//      키 없으면: Claude(에이전트)가 스테이브별로 <out>/stave-<id>-verdicts.json 작성(아래 스키마).
//      --sdk: 스테이브당 1콜로 자동 채점.
// 2) 집계(SHIP/HOLD):
//    node release-gate.mjs --verdicts out/book/regate --staves "..."
//      → 커버리지 강제 + 통과율 + 블로킹 목록 + 스테이브별 재생성 커맨드 + 종합 SHIP/HOLD.
//
// verdicts 스키마(스테이브별): {"stave":id,"panels":[{"panel":n,"pass":bool,"severity":"none|low|med|high",
//   "defects":["tag: note"],"scene_match":bool,"note":""}, ...],"blocking_panels":[n,...]}
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);

const RUBRIC = `이 책은 흑백 GRAPHIC-NOVEL(V-Level 7). 잉크 해칭/하프톤은 정상(결함 아님). 각 패널을 (a) 각본 scene/captions 의도와 (b) 하드페일 루브릭 둘 다로 판정.
HARD-FAIL(하나라도 있으면 pass=false):
- baked_text: 판독 가능/garbled 글자가 아트에 baked(간판·종이). 흐릿한 앰비언트 낙서는 허용, 판독가능 단어는 fail.
- empty_balloon: 빈 말풍선/콜아웃이 아트에 그려짐(텍스트는 나중에 HTML 로 얹음).
- colour_leak: 흑백 책에 색/틴트(금·노랑·세피아 등).
- no_background: scene 필요한데 빈 배경.
- wrong_count / duplicate_figure(같은 인물 2회) / floating_or_detached_head.
- identity_collapse: scene 대비 캐릭터가 틀림(무수염이어야 하는데 수염, 뾰족귀, 나이 틀림, 다른 캐릭터로 읽힘).
- text_image_mismatch: 이미지가 scene/caption 과 모순.
- anachronism: 근대 물건(자동차·전등·현대 의상) — 배경 Victorian ~1843.
- deformity: 손·얼굴·팔다리 기형.
severity: 위 하드페일 존재=high/med, scene 정합 약함=low, 무결=none. blocking_panels 에 pass=false 패널 번호.`;

// --- helpers ---
function parseStaves() {
  return String(arg("staves", "")).split(",").filter(Boolean).map((s) => {
    const parts = s.split("=");
    const id = parts[0], images = parts[1], script = parts[2];
    return { id, images, script };
  });
}
function scriptPanels(scriptPath) {
  const s = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const tier = s.adaptation?.default_tier || "teen";
  return (s.panels || []).map((p) => {
    const t = p.text?.[tier] || {};
    return { panel: p.n, scene: p.scene, characters: p.characters || [], captions: [t.narration, t.quote, ...((t.bubbles || []).map((b) => (b.speaker ? b.speaker + ": " : "") + b.text))].filter(Boolean) };
  });
}
const imgPath = (dir, n) => path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
const vPath = (outDir, id) => path.join(outDir, `stave-${id}-verdicts.json`);

const staves = parseStaves();
if (!staves.length) { console.error('--staves "id=imagesDir=scriptPath,..." 필요'); process.exit(2); }

// ===== 집계 모드 =====
if (has("verdicts")) {
  const outDir = arg("verdicts");
  let totalPanels = 0, totalPass = 0, anyBlock = false, anyUninspected = false;
  const report = [];
  for (const st of staves) {
    const panels = scriptPanels(st.script);
    totalPanels += panels.length;
    const vp = vPath(outDir, st.id);
    if (!fs.existsSync(vp)) { console.log(`\n■ Stave ${st.id}: ✗ verdicts 없음 (${panels.length}패널 전부 UNINSPECTED) → HOLD`); anyUninspected = true; report.push({ id: st.id, uninspected: panels.map((p) => p.panel) }); continue; }
    const v = JSON.parse(fs.readFileSync(vp, "utf8"));
    const byPanel = new Map((v.panels || []).map((r) => [r.panel, r]));
    // R24 커버리지 강제: 스크립트의 모든 패널에 verdict 가 있어야 한다.
    const uninspected = panels.filter((p) => !byPanel.has(p.panel)).map((p) => p.panel);
    const missingImg = panels.filter((p) => !fs.existsSync(imgPath(st.images, p.panel))).map((p) => p.panel);
    const fails = panels.filter((p) => byPanel.get(p.panel) && byPanel.get(p.panel).pass === false).map((p) => p.panel);
    const passN = panels.filter((p) => byPanel.get(p.panel) && byPanel.get(p.panel).pass === true).length;
    totalPass += passN;
    if (uninspected.length) anyUninspected = true;
    if (fails.length) anyBlock = true;
    if (missingImg.length) anyBlock = true;
    report.push({ id: st.id, n: panels.length, pass: passN, fails, uninspected, missingImg, verdicts: byPanel });
    console.log(`\n■ Stave ${st.id}: ${passN}/${panels.length} pass${fails.length ? " · FAIL [" + fails.join(",") + "]" : ""}${uninspected.length ? " · UNINSPECTED [" + uninspected.join(",") + "]" : ""}${missingImg.length ? " · 이미지없음 [" + missingImg.join(",") + "]" : ""}`);
    for (const n of fails) { const r = byPanel.get(n); console.log(`    P${n} [${r.severity || "?"}] ${(r.defects || []).join("; ") || r.note || ""}`); }
  }
  console.log(`\n================ 책 릴리스 게이트 ================`);
  console.log(`통과 ${totalPass}/${totalPanels} (${(100 * totalPass / totalPanels).toFixed(1)}%)`);
  // 재생성 플랜
  const plan = report.filter((r) => (r.fails && r.fails.length) || (r.uninspected && r.uninspected.length));
  if (plan.length) {
    console.log(`\n재생성/재검증 플랜:`);
    for (const r of plan) {
      const st = staves.find((s) => s.id === r.id);
      if (r.uninspected && r.uninspected.length) console.log(`  Stave ${r.id}: UNINSPECTED [${r.uninspected.join(",")}] → 먼저 검사 필요`);
      if (r.fails && r.fails.length) console.log(`  Stave ${r.id}: node scripts/comic/repair-loop.mjs --script ${st.script} --out ${st.images} --wf-gen wf/qwen-t2i-from-edit.api.json --wf-edit wf/qwen-edit-lightning.api.json --user user --pass password --panels ${r.fails.join(",")} --sdk`);
    }
  }
  if (anyUninspected) { console.log(`\n⛔ HOLD — 미검사 패널 존재(R24: 전수 아니면 게이트 무효).`); process.exit(2); }
  if (anyBlock) { console.log(`\n⛔ HOLD — 하드페일/이미지누락 패널 존재. 위 플랜으로 수렴 후 재게이트.`); process.exit(1); }
  console.log(`\n✅ SHIP — 전 ${totalPanels}패널 검사 완료·전원 PASS. (qc-book 스타일/연속성 게이트도 통과해야 최종 SHIP.)`); process.exit(0);
}

// ===== 매니페스트 모드 =====
const outDir = arg("out"); if (!outDir) { console.error("--out 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
let client = null;
if (has("sdk")) { try { const A = (await import("@anthropic-ai/sdk")).default; if (!process.env.ANTHROPIC_API_KEY) throw 0; client = new A(); } catch { console.error("--sdk 인데 sdk/key 없음 — 에이전트 경로로 진행"); } }

for (const st of staves) {
  const panels = scriptPanels(st.script);
  const manifest = {
    stave: st.id, rubric: RUBRIC,
    schema: `{"stave":"${st.id}","panels":[{"panel":n,"pass":bool,"severity":"none|low|med|high","defects":["tag: note"],"scene_match":bool,"note":""}],"blocking_panels":[n]}`,
    instruction: `이 스테이브의 모든 패널 이미지를 Read 해 각본 scene/captions 대비 루브릭으로 판정 → ${vPath(outDir, st.id)} 에 위 schema 로 기록. 반드시 전 ${panels.length}패널 포함(누락 시 커버리지 위반으로 HOLD).`,
    panels: panels.map((p) => ({ panel: p.panel, image: imgPath(st.images, p.panel), exists: fs.existsSync(imgPath(st.images, p.panel)), scene: p.scene, characters: p.characters, captions: p.captions })),
  };
  fs.writeFileSync(path.join(outDir, `stave-${st.id}-manifest.json`), JSON.stringify(manifest, null, 2));
  console.log(`manifest → stave-${st.id} (${panels.length} panels)`);
  if (client) {
    const content = [{ type: "text", text: `${RUBRIC}\n\nStave ${st.id} 전 패널. ONLY JSON: ${manifest.schema}` }];
    for (const p of manifest.panels) { if (!p.exists) continue; content.push({ type: "text", text: `P${p.panel} scene=${p.scene}; captions=${JSON.stringify(p.captions)}` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(p.image).toString("base64") } }); }
    const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 3000, messages: [{ role: "user", content }] });
    const txt = msg.content.map((c) => c.text || "").join("");
    try { fs.writeFileSync(vPath(outDir, st.id), txt.match(/\{[\s\S]*\}/)[0]); console.log(`  verdicts → stave-${st.id}-verdicts.json`); } catch { console.error(`  ✗ stave-${st.id} JSON 파싱 실패`); }
  }
}
if (!client) console.log(`\n다음: Claude 에이전트가 스테이브별로 전 패널을 Read → stave-<id>-verdicts.json 작성 → node release-gate.mjs --verdicts ${outDir} --staves "..."`);
