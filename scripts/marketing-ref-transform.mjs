// scripts/marketing-ref-transform.mjs
// docs/references/marketing/ 의 mojibake'd 파일에 안전한 기계적 변환을 일괄 적용한다.
// 한글 본문은 손대지 않음 (사용자가 수기로 정리).
//   - 'â' 3개 이상 런 → '═' 동일 길이      (헤더 데코레이션)
//   - 공백 사이 단독 'â' → '—'             (em-dash 구분자)
//   - 'Â·' → '·'                            (middle dot)
//   - 'LexiVault' → 'Vocaflow'              (브랜드명 — CLAUDE.md v06.2)

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/marketing-ref-transform.mjs <file>...');
  process.exit(1);
}

for (const file of files) {
  let s = readFileSync(file, 'utf-8');
  const before = s.length;
  s = s.replace(/â{3,}/g, m => '═'.repeat(m.length));
  s = s.replace(/(\s)â(\s)/g, '$1—$2');
  s = s.replace(/Â·/g, '·');
  s = s.replace(/LexiVault/g, 'Vocaflow');
  writeFileSync(file, s, 'utf-8');
  console.log(`✓ ${file}  (${before} → ${s.length} chars)`);
}
