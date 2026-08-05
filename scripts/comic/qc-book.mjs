// scripts/comic/qc-book.mjs
// S3.5 — 책-레벨 게이트: 여러 스테이지의 "모든 패널을 함께" 놓고 (a) 스타일/톤 균일성,
// (b) 스테이지 간 캐릭터 연속성을 검사한다.
//
// 왜 필요한가(구조 원리): 검증 게이트가 잡을 수 있는 결함은 그 게이트의 SCOPE 안에 증거가
// 담기는 것뿐이다. 스타일 일관성·연속성은 "나머지와 다르다"는 상대적 속성이라 스코프가 전체집합.
// 패널 게이트(1장)·교차 게이트(캐릭터 1인)로는 원리상 못 본다 → 전체를 보는 이 게이트가 필요.
// (Stave2 p14/p15 하프톤 이탈이 패널 게이트를 통과한 실측이 이 스테이지 신설의 근거.)
//
// 1) 매니페스트:  node qc-book.mjs --staves "s1=out/carol-adapted,s2=out/carol-stave2" --out out/book/qc [--sdk]
//      → <out>/book-manifest.json (스테이지별 전 패널 경로 + 균일성/연속성 루브릭).
//      Claude(에이전트/--sdk)가 <out>/book-verdicts.json 작성.
// 2) 소비:  node qc-book.mjs --verdicts <out> → 스타일 아웃라이어·연속성 이슈·스테이지별 재생성 목록.
import fs from "fs";
import path from "path";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const RUBRIC = "모든 스테이지의 모든 패널을 함께 보고 두 가지를 판정. (A) 스타일 균일성: 전 패널이 같은 플랫 흑백 잉크 룩인가. 하프톤/벤데이 점묘/스크린톤/반실사 렌더처럼 나머지와 이질적인 아웃라이어 패널을 골라낸다(개별로 grayscale 라도 이질적이면 아웃라이어). (B) 스테이지 간 연속성: 여러 스테이지에 재등장하는 캐릭터(특히 Scrooge)가 같은 인물로 읽히는가(얼굴/코/대머리/나이). 각 스테이지는 별도 참조시트로 생성됐으므로 이 대조가 유일한 연속성 검증.";
const outDir = arg("out", arg("verdicts"));
if (!outDir) { console.error("--out 또는 --verdicts 필요"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const vPath = path.join(outDir, "book-verdicts.json");

if (has("verdicts")) {
  if (!fs.existsSync(vPath)) { console.error(`no verdicts at ${vPath}`); process.exit(3); }
  const v = JSON.parse(fs.readFileSync(vPath, "utf8"));
  const outliers = v.style_outliers || [], cont = v.continuity_issues || [];
  console.log("=== 스타일 균일성 ===");
  if (!outliers.length) console.log("  ✓ 전 패널 톤 균일");
  else for (const o of outliers) console.log(`  ✗ ${o.stave} p${o.panel}: ${o.issue || "style outlier"}`);
  console.log("=== 스테이지 간 연속성 ===");
  if (!cont.length) console.log("  ✓ 캐릭터 연속성 OK");
  else for (const c of cont) console.log(`  ✗ ${c.character}: ${c.issue}`);
  // 스테이지별 재생성 목록
  const byStave = {};
  for (const o of outliers) (byStave[o.stave] ||= new Set()).add(o.panel);
  for (const c of cont) for (const p of c.regen || []) (byStave[p.stave] ||= new Set()).add(p.panel);
  console.log("\n=== 재생성 대상 ===");
  const bad = Object.keys(byStave).length;
  for (const [s, set] of Object.entries(byStave)) console.log(`  ${s}: --panels ${[...set].sort((a, b) => a - b).join(",")}`);
  if (bad) process.exit(1);
  console.log("  없음 — 책 전체 스타일·연속성 PASS"); process.exit(0);
}

// 매니페스트
const staves = String(arg("staves", "")).split(",").filter(Boolean).map((s) => { const [id, dir] = s.includes("=") ? s.split("=") : [path.basename(s), s]; return { id, dir }; });
if (!staves.length) { console.error("--staves \"s1=dir1,s2=dir2\" 필요"); process.exit(2); }
const manifest = { rubric: RUBRIC, instruction: "book-verdicts.json 에 {\"style_outliers\":[{\"stave\":id,\"panel\":n,\"issue\":\"\"}], \"continuity_issues\":[{\"character\":id,\"issue\":\"\",\"regen\":[{\"stave\":id,\"panel\":n}]}]} 로 기록. 이슈 없으면 빈 배열.", staves: staves.map((s) => ({ id: s.id, panels: fs.existsSync(s.dir) ? fs.readdirSync(s.dir).filter((f) => /^\d\d\.jpg$/.test(f)).sort().map((f) => ({ panel: +f.slice(0, 2), image: path.join(s.dir, f) })) : [] })) };
fs.writeFileSync(path.join(outDir, "book-manifest.json"), JSON.stringify(manifest, null, 2));
const total = manifest.staves.reduce((a, s) => a + s.panels.length, 0);
console.log(`book manifest → ${path.join(outDir, "book-manifest.json")} (${staves.length} staves, ${total} panels)`);

if (has("sdk")) {
  let Anthropic; try { Anthropic = (await import("@anthropic-ai/sdk")).default; } catch { console.error("@anthropic-ai/sdk 미설치"); process.exit(4); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 없음"); process.exit(4); }
  const client = new Anthropic();
  const content = [{ type: "text", text: `${RUBRIC}\n\nONLY JSON: {"style_outliers":[{"stave":"","panel":0,"issue":""}],"continuity_issues":[{"character":"","issue":"","regen":[{"stave":"","panel":0}]}]}` }];
  for (const s of manifest.staves) for (const p of s.panels) { content.push({ type: "text", text: `${s.id} p${p.panel}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(p.image).toString("base64") } }); }
  const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 1500, messages: [{ role: "user", content }] });
  const txt = msg.content.map((c) => c.text || "").join("");
  fs.writeFileSync(vPath, txt.match(/\{[\s\S]*\}/)[0]);
  console.log(`verdicts → ${vPath}`);
} else console.log(`다음: Claude 에이전트가 전 패널을 함께 보고 ${vPath} 작성 → node qc-book.mjs --verdicts ${outDir}`);
