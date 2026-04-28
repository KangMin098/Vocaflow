// scripts/smoke-tokens.mjs
// 토큰 패키지 런타임 smoke test — 실제 import 후 값을 사용해본다.
// tsc 결과물 없이도 구조만 검증하기 위해 정규식으로 공개 export 를 살펴본다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

const files = {
  index: 'packages/design-tokens/src/index.ts',
  colors: 'packages/design-tokens/src/colors.ts',
  spacing: 'packages/design-tokens/src/spacing.ts',
  radius: 'packages/design-tokens/src/radius.ts',
  shadow: 'packages/design-tokens/src/shadow.ts',
  motion: 'packages/design-tokens/src/motion.ts',
  typography: 'packages/design-tokens/src/typography.ts',
};

const expectedExports = {
  colors: ['colorsLight', 'colorsDark', 'gameColors', 'Colors'],
  spacing: ['spacing', 'SpacingKey'],
  radius: ['radius', 'RadiusKey'],
  shadow: ['shadowCss', 'shadowNative', 'ShadowKey'],
  motion: ['duration', 'easing', 'DurationKey', 'EasingKey'],
  typography: ['fontFamily', 'fontFamilyNative', 'breakpoints'],
};

let failed = 0;

for (const [k, path] of Object.entries(files)) {
  if (k === 'index') continue;
  const src = readFileSync(join(root, path), 'utf8');
  for (const sym of expectedExports[k]) {
    const re = new RegExp(`export\\s+(?:const|type)\\s+${sym}\\b`);
    if (!re.test(src)) {
      console.log(`✗ ${path}  missing export: ${sym}`);
      failed++;
    }
  }
}

// index.ts 의 re-export
const index = readFileSync(join(root, files.index), 'utf8');
for (const k of Object.keys(expectedExports)) {
  if (!index.includes(`./${k}`)) {
    console.log(`✗ index.ts  missing re-export: ./${k}`);
    failed++;
  }
}

// 기대 색상 값 sanity check (CLAUDE.md SSoT)
const colorsTs = readFileSync(join(root, files.colors), 'utf8');
const checks = [
  { name: 'p (light)', re: /colorsLight\s*=\s*\{[\s\S]*?p:\s*'#3B82F6'/ },
  { name: 'p (dark)',  re: /colorsDark\s*=\s*\{[\s\S]*?p:\s*'#60A5FA'/ },
  { name: 'wordBlitzGold', re: /wordBlitzGold:\s*'#FFE234'/ },
  { name: 'spellForgeBlue', re: /spellForgeBlue:\s*'#4A9FCF'/ },
];
for (const c of checks) {
  if (!c.re.test(colorsTs)) {
    console.log(`✗ colors.ts  expected value not found: ${c.name}`);
    failed++;
  }
}

if (failed === 0) {
  console.log('✓ design-tokens package exports are well-formed; key SSoT values present');
} else {
  console.log(`\n${failed} issues`);
  process.exitCode = 1;
}
