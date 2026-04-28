// scripts/verify-tokens.mjs
// 토큰 일관성 테스트 — 세 출처가 같은 값을 갖는지 검증한다.
//   1) packages/design-tokens/src/tokens.css   (CSS Variables 본체)
//   2) packages/design-tokens/src/colors.ts    (RN/JS 토큰 객체)
//   3) apps/web/src/app/globals.css            (현재 앱이 실제 사용 중인 값)
// 실행: node scripts/verify-tokens.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

// ─── 파서 ───────────────────────────────────────────────
function parseCssVars(css) {
  const out = { light: {}, dark: {} };
  // :root { ... }
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  // [data-theme="dark"] { ... }
  const darkMatch = css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);

  function extract(block) {
    const map = {};
    const re = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      // 값에서 인라인 주석 제거
      let val = m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
      map[m[1]] = val;
    }
    return map;
  }

  if (rootMatch) out.light = extract(rootMatch[1]);
  if (darkMatch) out.dark = extract(darkMatch[1]);
  return out;
}

// colors.ts 의 객체 리터럴에서 키→값 추출
function parseTsColors(ts) {
  function extractObject(name) {
    const re = new RegExp(`export const ${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const;`);
    const m = ts.match(re);
    if (!m) return null;
    const body = m[1];
    const map = {};
    // ...colorsLight 같은 spread는 무시 (외부에서 처리)
    const re2 = /(\w+)\s*:\s*'([^']+)'/g;
    let mm;
    while ((mm = re2.exec(body)) !== null) {
      map[mm[1]] = mm[2];
    }
    return map;
  }

  const light = extractObject('colorsLight');
  const darkOnly = extractObject('colorsDark');
  // colorsDark 는 { ...colorsLight, p: ..., ... } 형태이므로 베이스로 light 깔기
  const dark = { ...(light ?? {}), ...(darkOnly ?? {}) };
  return { light, dark };
}

// CSS 변수명(--p-light) ↔ TS 키(pLight) 매핑
function cssNameToTsKey(name) {
  // 'p-hover' -> 'pHover', 'p-light' -> 'pLight', 'p-dark' -> 'pDark', 'r-2xl' -> 'r2xl'
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// ─── 로드 ───────────────────────────────────────────────
const tokensCss = readFileSync(join(root, 'packages/design-tokens/src/tokens.css'), 'utf8');
const colorsTs = readFileSync(join(root, 'packages/design-tokens/src/colors.ts'), 'utf8');
const globalsCss = readFileSync(join(root, 'apps/web/src/app/globals.css'), 'utf8');

const A = parseCssVars(tokensCss);    // packages tokens.css
const B = parseCssVars(globalsCss);   // apps/web globals.css
const T = parseTsColors(colorsTs);    // colors.ts

// 색상 영역만 비교 대상으로 한정 (TS 객체에는 shadow/radius/motion 없음)
const COLOR_KEYS = [
  'p', 'p-hover', 'p-light', 'p-dark',
  'active', 'active-light',
  'success', 'success-light',
  'error', 'error-light',
  'warning', 'warning-light',
  'info', 'info-light',
  'bg', 'bg2', 'bg3',
  't1', 't2', 't3', 't4', 'ti',
  'bd', 'bdf', 'bde',
];

// 정규화(대소문자/공백)
const norm = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

const errors = [];
const warns = [];

function compare(label, mode, src, dst) {
  for (const k of COLOR_KEYS) {
    const a = src[k];
    const b = dst[k];
    if (a === undefined && b === undefined) continue;
    if (a === undefined) {
      warns.push(`[${label}/${mode}]  --${k}: tokens.css 에만 없음`);
      continue;
    }
    if (b === undefined) {
      // bde 가 dark 에 없는 식의 fallback 은 light 값을 그대로 사용 → OK
      continue;
    }
    if (norm(a) !== norm(b)) {
      errors.push(`[${label}/${mode}]  --${k}:  tokens.css=${a}  vs  ${label}=${b}`);
    }
  }
}

function compareTs(label, mode, cssMap, tsMap) {
  for (const k of COLOR_KEYS) {
    const a = cssMap[k];
    const tsKey = cssNameToTsKey(k);
    const b = tsMap[tsKey];
    if (a === undefined && b === undefined) continue;
    if (a !== undefined && b === undefined) {
      warns.push(`[${label}/${mode}]  --${k} (${tsKey}): TS 에 없음`);
      continue;
    }
    if (a === undefined) continue;
    if (norm(a) !== norm(b)) {
      errors.push(`[${label}/${mode}]  --${k} (TS:${tsKey}):  css=${a}  vs  ts=${b}`);
    }
  }
}

console.log('▶ Vocaflow token consistency check\n');

// globals.css 가 packages/design-tokens/tokens.css 를 @import 만 한다면 인라인 변수가 없어 OK.
const globalsImports = /@import\s+['"]@vocaflow\/design-tokens\/tokens\.css['"]/.test(globalsCss);
const globalsHasInlineRoot = /:root\s*\{[\s\S]*?--p\s*:/.test(globalsCss);

console.log('1) apps/web/globals.css imports tokens & has no duplicate :root tokens');
if (!globalsImports) {
  errors.push(`[globals.css]  '@import "@vocaflow/design-tokens/tokens.css"' 누락`);
}
if (globalsHasInlineRoot) {
  errors.push(`[globals.css]  여전히 :root 안에 --p 등 토큰을 인라인하고 있음 — SSoT 분기 발생`);
}
// 여전히 토큰을 인라인하는 (문제 있는) 경우만 값 비교.
if (globalsHasInlineRoot) {
  compare('globals.css', 'light', A.light, B.light);
  compare('globals.css', 'dark',  A.dark,  B.dark);
}

console.log('2) tokens.css  ↔  colors.ts');
compareTs('colors.ts', 'light', A.light, T.light);
compareTs('colors.ts', 'dark',  A.dark,  T.dark);

if (warns.length) {
  console.log('\n— warnings —');
  for (const w of warns) console.log('  · ' + w);
}

if (errors.length) {
  console.log('\n✗ MISMATCH:');
  for (const e of errors) console.log('  ✗ ' + e);
  process.exitCode = 1;
} else {
  console.log('\n✓ all color tokens match across the three sources');
}
