// scripts/comic/qc-regress.mjs
// 회귀 검사 — "재설계가 그 재난을 막는가"의 증명.
// 알려진 결함 패널(expected_fail)을, QC 게이트 산출(verdicts)이 전부 FAIL 로 잡는지 검증한다.
// Usage:
//   node scripts/comic/qc-regress.mjs \
//     --expected scripts/comic/fixtures/carol-stave1-known-bad.expected.json \
//     --verdicts scripts/comic/fixtures/carol-stave1-known-bad.verdicts.json
// 종료코드: 놓친 결함 있으면 1(회귀), 전부 잡으면 0.
import fs from "fs";
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? null : process.argv[i + 1]; };
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const exp = rd(arg("expected") || "scripts/comic/fixtures/carol-stave1-known-bad.expected.json").expected_fail;
const ver = rd(arg("verdicts") || "scripts/comic/fixtures/carol-stave1-known-bad.verdicts.json");

let missed = 0, wrongReason = 0, caught = 0;
for (const [n, cats] of Object.entries(exp)) {
  const v = ver[n];
  if (!v || v.pass !== false) { console.log(`  ✗ P${n}: 게이트가 놓침(pass=${v ? v.pass : "없음"}) — 기대 결함 ${JSON.stringify(cats)}`); missed++; continue; }
  const got = v.hard_fail || [];
  const overlap = cats.some((c) => got.includes(c));
  if (!overlap) { console.log(`  ⚠ P${n}: 잡았으나 범주 불일치 — 기대 ${JSON.stringify(cats)} / 실제 ${JSON.stringify(got)}`); wrongReason++; }
  else { console.log(`  ✓ P${n}: 잡음 [${got.join(",")}]`); caught++; }
}
const total = Object.keys(exp).length;
console.log(`\n회귀: ${caught}/${total} 정확 포착 · ${wrongReason} 범주불일치 · ${missed} 놓침`);
if (missed) { console.log("🔴 REGRESSION — 게이트가 알려진 재난을 통과시킴."); process.exit(1); }
console.log("🟢 PASS — 게이트가 알려진 재난 결함을 모두 차단함(재설계가 재발을 막음).");
process.exit(0);
