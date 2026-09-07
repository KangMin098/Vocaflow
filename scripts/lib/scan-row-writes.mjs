// scripts/lib/scan-row-writes.mjs
//
// **루프 안에서 한 행씩 쓰는 코드를 찾는다.**
//
// ── 왜 필요한가 (실측 2026-09-06) ───────────────────────────────────
// DB 가 **25분간 전면 정지**했다. 원인은 사전 드레인이 `/rest/v1/shared_dictionary` 에
// 1분에 **1,995건(초당 33건)을 한 행씩 PATCH** 한 것이다. 그 WAL 이 229MB · write 88.5초짜리
// 체크포인트를 만들었고, I/O 가 포화되면서 `cron.job_run_details` 조인 같은 사소한 쿼리가
// **42.8초** 걸렸다. 02:09 부터 SQL·Auth·REST 가 전부 504 였고 `select 1` 조차 타임아웃했다.
//
// 한 행씩 쓰는 것은 **느린 게 아니라 위험하다.** 같은 일을 배치 upsert 로 하면 왕복이
// 1/500 로 줄고 WAL 도 줄어든다. 이 저장소는 드레인이 많아서 같은 함정이 계속 생긴다 —
// 주석으로는 못 막으므로 기계가 훑는다(scan-unpaged-queries.mjs 와 같은 발상).
//
// ── 무엇을 의심하는가 ────────────────────────────────────────────────
// `.from(t)` 체인에 `.update(`/`.delete(` 가 있고 `.eq(`/`.match(` 로 **한 행을 겨냥**하는데,
// 그 위 40줄 안에 같거나 더 얕은 들여쓰기의 루프 머리(`for`·`while`·`.map(`·`.forEach(`)가 있으면 후보다.
//
// **가드로 인정하는 것**(후보에서 뺀다):
//   · `.upsert(` 또는 `.insert(` 의 인자가 배열스러운 이름(batch·rows·chunk·slice·payload·items)
//   · 체인 근처에 `onConflict` 가 있는 upsert — 배치 적재 관용구
//
// 판정은 **후보**다 — 표가 작거나 실행이 드물면 문제가 아니다. 그래서 파일·줄·표 이름과 함께 낸다.
// (CLAUDE.md 의 교훈: 「루프 애니메이션 금지」로 정당한 로더 20곳을 걸었던 규칙처럼,
//  판정을 좁히지 못하면 규칙이 틀린 것이다. 여기서는 **루프 안 + 단건 겨냥** 둘 다 요구한다.)
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/lib/scan-row-writes.mjs [--json] [--max N]
//   종료 코드는 항상 0 — 이건 게이트가 아니라 목록이다(고칠 사람이 판단한다).

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['scripts', 'apps/web/src', 'packages'];
const EXT = new Set(['.ts', '.tsx', '.mjs', '.mts', '.js']);
const SKIP = /node_modules|\.next|dist|build|__tests__|\.test\.|\.spec\./;

/** 체인을 이어 붙여 보는 길이 — 체이닝이 여러 줄에 걸친다. */
const CHAIN_CHARS = 500;
/** 루프 머리를 위로 몇 줄까지 찾을까. */
const LOOP_LOOKBACK = 40;

const LOOP_HEAD = /(^|[^\w])(for\s*\(|for\s+await\s*\(|while\s*\(|\.map\s*\(|\.forEach\s*\(|\.flatMap\s*\()/;
const BATCHY = /\b(batch|batches|rows|chunk|chunks|slice|payload|items|records|values)\b/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (SKIP.test(full)) continue;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function indentOf(line) {
  const m = /^(\s*)/.exec(line);
  return m ? m[1].replace(/\t/g, '  ').length : 0;
}

/** 이 줄이 루프 안에 있나 — 위로 훑어 같거나 얕은 들여쓰기의 루프 머리를 찾는다. */
function loopContext(lines, idx) {
  const mine = indentOf(lines[idx]);
  for (let i = idx - 1; i >= 0 && i >= idx - LOOP_LOOKBACK; i -= 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const ind = indentOf(line);
    if (ind >= mine) continue; // 더 깊거나 같은 자리는 형제 — 머리가 아니다
    if (LOOP_HEAD.test(line)) return { line: i + 1, text: line.trim().slice(0, 90) };
    if (ind === 0) break; // 최상위까지 올라왔다
  }
  return null;
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const from = /\.from\s*\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/i.exec(lines[i]);
    if (!from) continue;

    // 줄 오프셋으로 체인을 잘라 온다(같은 내용의 줄이 여러 번 나와도 안전하다).
    const offset = lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
    const window = src.slice(offset, offset + CHAIN_CHARS);

    const isWrite = /\.(update|delete)\s*\(/.test(window);
    if (!isWrite) continue;

    // 한 행을 겨냥하는가 — eq/match 가 있어야 단건이다.
    const targetsOne = /\.(eq|match)\s*\(/.test(window);
    if (!targetsOne) continue;

    // 배치 관용구면 뺀다.
    if (/\.upsert\s*\(/.test(window) && /onConflict/.test(window)) continue;
    if (/\.(insert|upsert)\s*\(\s*[A-Za-z_$][\w$]*\s*[,)]/.test(window)) {
      const arg = /\.(?:insert|upsert)\s*\(\s*([A-Za-z_$][\w$]*)/.exec(window);
      if (arg && BATCHY.test(arg[1])) continue;
    }

    const loop = loopContext(lines, i);
    if (!loop) continue;

    hits.push({
      file: file.replace(/\\/g, '/'),
      line: i + 1,
      table: from[1],
      op: /\.update\s*\(/.test(window) ? 'update' : 'delete',
      loopAt: loop.line,
      loop: loop.text,
      snippet: lines[i].trim().slice(0, 110),
    });
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const maxIdx = args.indexOf('--max');
  const max = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 60;

  const files = ROOTS.flatMap((r) => walk(r));
  const hits = files.flatMap(scanFile);

  if (asJson) {
    process.stdout.write(JSON.stringify({ scanned: files.length, hits }, null, 2));
    return;
  }

  console.log(`파일 ${files.length}개 훑음 · 루프 안 단건 쓰기 후보 ${hits.length}건\n`);
  if (hits.length === 0) {
    console.log('후보 없음.');
    return;
  }

  const byTable = new Map();
  for (const h of hits) byTable.set(h.table, (byTable.get(h.table) ?? 0) + 1);
  console.log('표별 건수 (많은 것부터):');
  for (const [t, n] of [...byTable].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${t}`);
  }

  console.log('\n후보:');
  for (const h of hits.slice(0, max)) {
    console.log(`  ${h.file}:${h.line}  [${h.table}.${h.op}]  ← 루프 ${h.loopAt}행: ${h.loop}`);
    console.log(`      ${h.snippet}`);
  }
  if (hits.length > max) console.log(`  … 그리고 ${hits.length - max}건 더 (--max 로 늘린다)`);

  console.log(`
고치는 법 — 왕복을 줄이는 것이 아니라 **WAL 을 줄이는 것**이 목적이다:
  · 갱신이면 배치 upsert 로 모은다: .upsert(rows, { onConflict: '<키>' })
  · 정말 한 행씩 해야 하면 초당 상한을 둔다. 이 DB 는 초당 33건에서 25분 멈췄다.
  · 대량 갱신은 RPC 하나로 넘겨 서버에서 한 번에 처리하는 편이 낫다.
드레인을 시작하기 전에 /db-checkpoint before <라벨> 을 찍어 두면 무엇이 바뀌었는지 남는다.`);
}

main();
