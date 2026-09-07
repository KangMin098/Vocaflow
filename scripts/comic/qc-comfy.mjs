// scripts/comic/qc-comfy.mjs
// Vision-QC 게이트 (평가 기능) + 재생성 대상 산출.
// 폐루프: gen-comfy(생성) → qc-comfy(평가) → gen-comfy --panels <fail>(수리) → 반복.
//
// 두 단계로 쓴다:
//   1) 매니페스트 생성:  node qc-comfy.mjs --script <s.json> --images <dir> --out <qcdir>
//        → <qcdir>/qc-manifest.json 작성. 각 패널의 이미지 경로 + 스펙 + hard-fail 루브릭.
//        · ANTHROPIC_API_KEY(+ @anthropic-ai/sdk) 있으면 --sdk 로 자동 채점까지.
//        · 없으면(기본) Claude 에이전트/사람이 이미지+매니페스트를 보고 <qcdir>/qc-verdicts.json 을 채운다.
//   2) 판정 소비:  node qc-comfy.mjs --verdicts <qcdir>  (또는 1단계와 같은 --out)
//        → PASS/FAIL 요약 + 재생성 인자 출력:  --panels 2,10,12
//
// verdicts 스키마 (Claude/SDK 가 채움):
//   { "2": { "pass": false, "hard_fail": ["baked_text"], "scores": {...}, "regen_hint": "blank sign; ..." }, ... }
import fs from "fs";
import path from "path";
import { styleForLevel } from "./comic-prompt.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);

// 패널이 통과해야 하는 hard-fail 규칙(요청하신 "평가" 기준의 핵심).
const HARD_FAIL_RUBRIC = [
  "baked_text: any readable letters/words baked into the art (signs, gravestones, paper) — misspelled or not; diegetic text must be blank in art and supplied as HTML",
  "empty_balloon: blank speech balloons/caption boxes drawn into the art (they collide with the HTML text layer)",
  "no_background: figure floats on a checkerboard/transparency grid or blank void instead of the described scene",
  "colour_leak: any colour in the flat black-and-white ink book",
  "wrong_or_duplicate_character: the character does not match its reference sheet, or a second/duplicate person appears",
  "identity_collapse: Scrooge and Marley are indistinguishable (Marley must show jaw-bandage + money-chain + be translucent)",
  "text_image_mismatch: the picture contradicts the panel's caption/scene (e.g. caption says sliding on ice but a cart is drawn; says transparent but drawn opaque)",
  "artifact: extra limbs, deformed hands, garbled anatomy, style break (thin coloring-book lines / photoreal / 3D)",
  "style_drift: 이 책의 아트 레지스터(레벨 연동, 아래 명시)와 다르면 실패. 저레벨(cartoon/comic)은 flat 잉크가 정상이라 halftone/반실사가 결함이지만, 고레벨(graphic-novel/realistic)은 오히려 halftone/사실적 해칭이 정상이고 유아틱 플랫카툰이 결함이다. 색은 어느 레벨이든 결함. 책 전체 톤 균일성은 qc-book/S3.5.",
];

function buildSpec(script, imagesDir) {
  const byId = Object.fromEntries((script.cast || []).map((c) => [c.id, c]));
  const tier = script.adaptation?.default_tier || "teen";
  return (script.panels || []).map((p) => {
    const t = p.text?.[tier] || {};
    const captions = (t.bubbles || []).map((b) => (b.speaker ? `${b.speaker}: ` : "") + b.text);
    const chars = (p.characters || []).map((id) => byId[id]).filter(Boolean);
    const img = path.join(imagesDir, `${String(p.n).padStart(2, "0")}.jpg`);
    return {
      n: p.n,
      image: img,
      image_exists: fs.existsSync(img),
      scene: p.scene,
      characters: chars.map((c) => ({ id: c.id, look: c.anchor, distinct_from: c.distinct_from })),
      narration: t.narration || "",
      captions,
    };
  });
}

const outDir = arg("out", arg("verdicts"));
if (!outDir) { console.error("--out <qcdir> (매니페스트 생성) 또는 --verdicts <qcdir> (판정 소비) 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const verdictsPath = path.join(outDir, "qc-verdicts.json");

// ── 2단계: 판정 소비 모드 ──
if (has("verdicts")) {
  if (!fs.existsSync(verdictsPath)) { console.error(`no verdicts at ${verdictsPath} — 먼저 매니페스트를 채우세요`); process.exit(3); }
  const v = JSON.parse(fs.readFileSync(verdictsPath, "utf8"));
  const rows = Object.entries(v).map(([n, r]) => ({ n: +n, ...r })).sort((a, b) => a.n - b.n);
  const fails = rows.filter((r) => r.pass === false);
  for (const r of rows) console.log(`${r.pass ? "✓" : "✗"} panel ${r.n}${r.pass ? "" : "  [" + (r.hard_fail || []).join(",") + "]  → " + (r.regen_hint || "")}`);
  console.log(`\n${rows.length - fails.length}/${rows.length} pass`);
  if (fails.length) console.log(`REGEN: --panels ${fails.map((r) => r.n).join(",")}`);
  else console.log("ALL PASS — ready to assemble/ship");
  process.exit(fails.length ? 1 : 0);
}

// ── 1단계: 매니페스트 생성 ──
const script = JSON.parse(fs.readFileSync(path.isAbsolute(arg("script")) ? arg("script") : path.join(process.cwd(), arg("script")), "utf8"));
const imagesDir = arg("images");
if (!imagesDir) { console.error("--images <dir> 필요"); process.exit(2); }
const spec = buildSpec(script, imagesDir);
const vlevel = script.adaptation?.target_v_level ?? 6;
const register = styleForLevel(vlevel).register;
const manifest = { rubric: HARD_FAIL_RUBRIC, book_v_level: vlevel, expected_art_register: register, instruction: `이 책은 V-Level ${vlevel} → 기대 아트 레지스터 = "${register}" (레벨보다 약간 상향). style_drift 는 이 레지스터 기준으로 판단(고레벨이면 halftone/사실적 해칭은 정상, 유아틱 플랫카툰이 결함). 각 패널을 scene/captions/characters 와 대조해 hard_fail 위반 있으면 pass=false. qc-verdicts.json 에 {panel:{pass,hard_fail[],scores{},regen_hint}} 로 기록.`, panels: spec };
fs.writeFileSync(path.join(outDir, "qc-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`manifest → ${path.join(outDir, "qc-manifest.json")}  (${spec.length} panels, ${spec.filter((s) => !s.image_exists).length} missing images)`);

if (has("sdk")) {
  let Anthropic;
  try { Anthropic = (await import("@anthropic-ai/sdk")).default; } catch { console.error("@anthropic-ai/sdk 미설치 — npm i @anthropic-ai/sdk 후 재시도, 또는 --sdk 없이 에이전트 채점"); process.exit(4); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음"); process.exit(4); }
  const client = new Anthropic();
  const verdicts = {};
  for (const s of spec) {
    if (!s.image_exists) { verdicts[s.n] = { pass: false, hard_fail: ["missing_image"], regen_hint: "not generated" }; continue; }
    const b64 = fs.readFileSync(s.image).toString("base64");
    const msg = await client.messages.create({
      model: "claude-opus-4-8", max_tokens: 700,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: `You are a strict comic-QC gate for an English-learning webtoon. Rubric (any violation → pass=false):\n${HARD_FAIL_RUBRIC.map((r) => "- " + r).join("\n")}\n\nPanel ${s.n} spec:\nscene: ${s.scene}\ncharacters: ${JSON.stringify(s.characters)}\nnarration: ${s.narration}\ncaptions: ${JSON.stringify(s.captions)}\n\nReturn ONLY compact JSON: {"pass":bool,"hard_fail":[..],"scores":{"character":0-10,"scene":0-10,"style":0-10,"text_match":0-10},"regen_hint":"<one concrete corrective instruction>"}` },
      ] }],
    });
    const txt = msg.content.map((c) => c.text || "").join("");
    try { verdicts[s.n] = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]); } catch { verdicts[s.n] = { pass: false, hard_fail: ["qc_parse_error"], raw: txt.slice(0, 200) }; }
    console.log(`panel ${s.n}: ${verdicts[s.n].pass ? "PASS" : "FAIL " + (verdicts[s.n].hard_fail || []).join(",")}`);
  }
  fs.writeFileSync(verdictsPath, JSON.stringify(verdicts, null, 2));
  console.log(`verdicts → ${verdictsPath}`);
} else {
  console.log(`\n다음: Claude 에이전트가 위 매니페스트의 각 이미지를 열어 채점하고 ${verdictsPath} 를 작성 →`);
  console.log(`      node scripts/comic/qc-comfy.mjs --verdicts ${outDir}   (재생성 대상 출력)`);
}
