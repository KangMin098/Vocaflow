// scripts/fix-mojibake.mjs
// UTF-8 바이트가 Latin-1 으로 잘못 읽힌 후 다시 UTF-8 로 저장돼서 발생한
// 더블 인코딩(mojibake)을 일괄 복구한다.
//   원본 UTF-8 바이트 → Latin-1 디코드 → 그대로 UTF-8 인코드  =  mojibake
//   복구: UTF-8 디코드 → Latin-1 인코드 → UTF-8 디코드  =  원본
// 사용:  node scripts/fix-mojibake.mjs <file1> [file2 ...]
//        node scripts/fix-mojibake.mjs --check <file>     (덮어쓰지 않고 첫 200자만 출력)

import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkOnly = args[0] === '--check';
const files = checkOnly ? args.slice(1) : args;

if (!files.length) {
  console.error('Usage: node scripts/fix-mojibake.mjs [--check] <file>...');
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  try {
    const text = readFileSync(file, 'utf-8');
    // codepoint 가 모두 0xFF 이하여야 round-trip 안전.
    let canFix = true;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0xFF) { canFix = false; break; }
    }
    if (!canFix) {
      console.warn(`[skip] ${file}  파일에 0xFF 초과 codepoint 가 있어 latin1 round-trip 불가 — 이미 정상이거나 부분 복구된 상태`);
      continue;
    }
    const fixed = Buffer.from(text, 'latin1').toString('utf-8');
    if (checkOnly) {
      console.log(`── ${file} ──\n${fixed.slice(0, 400)}\n`);
    } else {
      writeFileSync(file, fixed, 'utf-8');
      console.log(`✓ fixed: ${file}`);
    }
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
    failed++;
  }
}

if (failed) process.exitCode = 1;
