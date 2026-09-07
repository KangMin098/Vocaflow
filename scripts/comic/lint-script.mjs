// scripts/comic/lint-script.mjs
// L0 하드닝 강제 — 스크립트를 "생성 전"에 검사해 결함을 요청하는 프롬프트를 막는다(R2/R3).
// Usage: node scripts/comic/lint-script.mjs --script <s.json> [--tier teen]
// 종료코드: error 있으면 1(생성 차단), 없으면 0(warning 만 있어도 통과).
import fs from "fs";
import path from "path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const scriptArg = arg("script");
if (!scriptArg) { console.error("--script <s.json> 필요"); process.exit(2); }
const script = JSON.parse(fs.readFileSync(path.isAbsolute(scriptArg) ? scriptArg : path.join(process.cwd(), scriptArg), "utf8"));
const tier = arg("tier", script.adaptation?.default_tier || "teen");
// 화자 라벨은 cast 의 id 또는 name 과 매칭(예: id "tim" ↔ 라벨 "TINY TIM"=name). Stave3 에서 발견.
const castIds = new Set(); for (const c of script.cast || []) { castIds.add(String(c.id).toLowerCase()); if (c.name) castIds.add(String(c.name).toLowerCase()); }

// ── 규칙 ──
const CHROMA = /\b(red|reddish|blue|bluish|green|greenish|yellow|orange|purple|violet|pink|brown|ruddy|golden|gold|crimson|scarlet|tan|amber|teal|magenta|turquoise)\b/i; // white/black/grey/silver = 잉크 팔레트라 허용
// 간판/글자 요청만 잡는다. 동사 "reading a book" 오탐 방지(Stave2 P7 에서 발견 → 규칙 개선):
// "sign reading" · "reading '따옴표'" · 따옴표 텍스트 · ALLCAPS 간판만.
const BAKED = /\bsign\s+reading\b|\breading\s+["'“]|\binscribed\b|\bengraved with\b|[“"'][^“”"']{2,}[”"']|\b[A-Z]{3,}\b/;
const ISOBG = /\bplain white background\b|\bwhite background\b|\bisolated on\b|\btransparent background\b|\bplain background\b|\bcheckerboard\b|\bblank background\b/i;
const META = /^\s*(drawn as|rendered as|in the style of a simple)\b/i;
const CLOSEUP = /close[- ]?up|tight portrait|extreme close|face fills|head and shoulders/i;

let errors = 0, warns = 0;
const E = (n, msg) => { console.log(`  ✗ [E] P${n}: ${msg}`); errors++; };
const W = (n, msg) => { console.log(`  · [W] P${n}: ${msg}`); warns++; };

for (const p of script.panels || []) {
  const scene = p.scene || "";
  const m1 = scene.match(CHROMA); if (m1) E(p.n, `scene에 색단어 "${m1[0]}" — 잉크 표현(stark black ink)으로 치환 (R2 컬러누출)`);
  const m2 = scene.match(BAKED); if (m2) E(p.n, `scene가 베이크 텍스트를 요청("${m2[0]}") — 빈 판으로 그리고 텍스트는 HTML 캡션으로 (R2 baked_text)`);
  const m3 = scene.match(ISOBG); if (m3) E(p.n, `scene가 무배경/고립("${m3[0]}") — 구체 배경 강제 (R2 no_background)`);
  if (META.test(scene)) E(p.n, `scene가 메타 프리픽스로 시작 — INK/HARDBW가 이미 스타일을 담당하므로 제거`);

  // ref 모드 — close-up 인데 noref 명시 안 하면 auto-noref 표류 위험(R3)
  const chars = p.characters || [];
  if (chars.length && CLOSEUP.test(`${p.composition || ""} ${scene}`) && p.noref !== false)
    W(p.n, `close-up + noref 미명시 → auto-noref 표류 위험. "noref": false 로 참조 강제 권장 (R3)`);

  // 텍스트/화자 규칙
  const t = p.text?.[tier] || {};
  const bubbles = t.bubbles || [];
  if (bubbles.length > 2) W(p.n, `캡션 ${bubbles.length}개 > 2 — 인지부하(≤2 권장, R4)`);
  for (const b of bubbles) {
    if (b.kind === "speech" && b.speaker) {
      if (!castIds.has(b.speaker.toLowerCase()))
        E(p.n, `대사 화자 "${b.speaker}"가 이 패널 등장인물${JSON.stringify(chars)}에 없음 — 화면밖 화자(R3/학습혼란). 화자를 화면에 넣거나 narration 으로`);
    }
  }
}

console.log(`\nlint: ${errors} error · ${warns} warning  (${(script.panels || []).length} panels)`);
if (errors) { console.log("BLOCK — 생성 전 위 error 를 수정하세요."); process.exit(1); }
console.log("PASS — 하드닝 규칙 통과.");
process.exit(0);
