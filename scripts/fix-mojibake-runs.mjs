// scripts/fix-mojibake-runs.mjs
// 부분 복구 버전. 0x80–0xFF codepoint 의 연속 런만 골라 UTF-8 로 재해석한다.
// 이미 정상인 ASCII / 0xFF 초과(═, —, 한글 등) codepoint 는 그대로 통과시킨다.
// control byte(0x80–0x9F) 가 복사 과정에서 누락된 글자는 U+FFFD(�) 로 표시된다 — 사용자 수기 정리 대상.
//
// 사용:  node scripts/fix-mojibake-runs.mjs <file>...

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/fix-mojibake-runs.mjs <file>...');
  process.exit(1);
}

function fix(text) {
  const out = [];
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    out.push(Buffer.from(pending).toString('utf-8'));
    pending = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x80 && c <= 0xFF) {
      pending.push(c);
    } else {
      flush();
      out.push(text[i]);
    }
  }
  flush();
  return out.join('');
}

for (const file of files) {
  try {
    const before = readFileSync(file, 'utf-8');
    const after = fix(before);
    if (after === before) {
      console.log(`= ${file}  (no change)`);
      continue;
    }
    const lostCount = (after.match(/�/g) || []).length;
    writeFileSync(file, after, 'utf-8');
    console.log(`✓ ${file}  ${before.length} → ${after.length} chars` + (lostCount ? `  (${lostCount} lost bytes → �)` : ''));
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
    process.exitCode = 1;
  }
}
