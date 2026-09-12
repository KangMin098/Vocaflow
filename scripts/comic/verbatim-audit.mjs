// scripts/comic/verbatim-audit.mjs
// 구조적 가드(R28): verbatim:true 로 표기된 대사를 정본(Dickens 1843) 참조와 대조해
// 원문에 없는(=패러프레이즈를 verbatim으로 오표기한) 라인을 플래그한다.
// 영어학습 제품이 "1차 인용"을 잘못 붙이는 것을 게시 전에 막는다.
//   node verbatim-audit.mjs --scripts "S1.json,S2.json,..."   (미지정 시 carol 5권)
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : d; };
const HERE = import.meta.dirname;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// 정본 참조(우리가 쓰는 아이콘 라인들, 정규화 대조용). 필요 시 확장.
const CANON = [
  "a merry christmas uncle god save you", "bah humbug",
  "if they would rather die they had better do it and decrease the surplus population",
  "i wear the chain i forged in life i made it link by link and yard by yard",
  "you will be haunted by three spirits expect the first to morrow when the bell tolls one",
  "i am the ghost of christmas past", "another idol has displaced me",
  "i release you with a full heart for the love of him you once were",
  "no more show me no more haunt me no longer i don t wish to see it",
  "come in come in and know me better man",
  "you have never seen the like of me before look upon me",
  "a merry christmas to us all my dears god bless us", "god bless us every one",
  "i see a vacant seat and a crutch without an owner if these shadows remain unaltered by the future the child will die",
  "my life upon this globe is very brief it ends to night",
  "this boy is ignorance this girl is want beware them both but most of all beware this boy",
  "are there no prisons are there no workhouses",
  "my little little child my little child",
  "am i that man who lay upon the bed no spirit oh no no",
  "are these the shadows of the things that will be or are they shadows of things that may be only",
  "i will honour christmas in my heart and try to keep it all the year i am not the man i was",
  "i am as light as a feather i am as happy as an angel i am as merry as a schoolboy a merry christmas to everybody",
  "what s to day my fine fellow", "and therefore i am about to raise your salary",
].map(norm);
// 부분 겹침(정본에 버블이 포함되거나 그 반대)로 verbatim 성립 판정.
const matches = (b) => { const n = norm(b); return CANON.some((c) => c.includes(n) || n.includes(c) || overlap(n, c) >= 0.8); };
function overlap(a, c) { const A = new Set(a.split(" ")), C = c.split(" "); let h = 0; for (const w of C) if (A.has(w)) h++; return C.length ? h / C.length : 0; }

const scripts = (arg("scripts") ? String(arg("scripts")).split(",") : ["carol-stave1", "carol-stave2", "carol-stave3", "carol-stave4", "carol-stave5"].map((x) => path.join(HERE, "examples", x + ".adapted.json")));
let flagged = 0, total = 0;
for (const sp of scripts) {
  const j = JSON.parse(fs.readFileSync(sp, "utf8")); const tier = j.adaptation?.default_tier || "teen";
  for (const p of (j.panels || [])) for (const b of (p.text?.[tier]?.bubbles || [])) {
    if (b.verbatim !== true) continue; total++;
    if (!matches(b.text)) { flagged++; console.log(`⚑ ${path.basename(sp)} P${p.n} [${b.speaker || ""}] verbatim 미스매치: "${b.text}"`); }
  }
}
console.log(`\nverbatim 대사 ${total}건 · 정본 미스매치 ${flagged}건`);
process.exit(flagged ? 1 : 0);
