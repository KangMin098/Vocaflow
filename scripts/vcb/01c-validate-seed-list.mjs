// scripts/vcb/01c-validate-seed-list.mjs
// VCB Method B — seed-list.jsonl 외부 검증.
// 슬래시 명령 /vcb-seed-list 가 종료 시 자동 호출.
// 결과: <input>.validation.json 생성.
//
// 순수 Node.js (npm install 불필요). pnpm 환경에서도 그대로 동작.
//
// 사용:
//   node scripts/vcb/01c-validate-seed-list.mjs <path-to-seed-list.jsonl>
//
// CLAUDE.md §19.4b 정합.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_POS = new Set([
  'NOUN',
  'VERB',
  'ADJ',
  'ADV',
  'PREP',
  'CONJ',
  'PRON',
  'DET',
  'INTJ',
]);
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const VALID_TIER = new Set(['core', 'common', 'moderate', 'rare']);

// 브랜드/출처명 denylist — rationale_short 에 포함 시 reject.
// P3 (§19 미정 항목 #2 해소): scripts/vcb/data/brand-denylist.json 외부 로딩.
function loadBrandDenylist() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(here, 'data', 'brand-denylist.json');
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const all = [];
    if (parsed.categories) {
      for (const list of Object.values(parsed.categories)) {
        if (Array.isArray(list)) all.push(...list);
      }
    }
    return all;
  } catch {
    return [];
  }
}
const BRAND_DENYLIST = loadBrandDenylist();

function exitWith(code, payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function readFileSafe(p) {
  if (!fs.existsSync(p)) {
    exitWith(1, { ok: false, error: 'file not found', path: p });
  }
  const buf = fs.readFileSync(p);
  return { buf, text: buf.toString('utf8') };
}

function checkEncoding(buf, text) {
  const hasBom =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const hasCrlf = text.includes('\r\n');
  return { hasBom, hasCrlf };
}

function validateLine(line, lineNumber) {
  const errors = [];

  let obj;
  try {
    obj = JSON.parse(line);
  } catch (e) {
    return {
      errors: [
        {
          line: lineNumber,
          code: 'INVALID_JSON',
          message: String(e.message),
        },
      ],
      item: null,
    };
  }

  if (typeof obj !== 'object' || obj === null) {
    return {
      errors: [
        {
          line: lineNumber,
          code: 'NOT_OBJECT',
          message: 'line must be a JSON object',
        },
      ],
      item: null,
    };
  }

  // lemma
  if (typeof obj.lemma !== 'string' || obj.lemma.length === 0) {
    errors.push({
      line: lineNumber,
      code: 'BAD_LEMMA',
      message: 'lemma must be non-empty string',
    });
  } else if (obj.lemma !== obj.lemma.toLowerCase()) {
    errors.push({
      line: lineNumber,
      code: 'LEMMA_NOT_LOWER',
      message: `lemma must be lowercase: ${obj.lemma}`,
    });
  } else if (/\s/.test(obj.lemma)) {
    errors.push({
      line: lineNumber,
      code: 'LEMMA_HAS_WHITESPACE',
      message: `lemma cannot contain whitespace: ${obj.lemma}`,
    });
  }

  // pos
  if (!VALID_POS.has(obj.pos)) {
    errors.push({
      line: lineNumber,
      code: 'BAD_POS',
      message: `invalid pos: ${obj.pos}`,
    });
  }

  // cefr_estimate
  if (!VALID_CEFR.has(obj.cefr_estimate)) {
    errors.push({
      line: lineNumber,
      code: 'BAD_CEFR',
      message: `invalid cefr_estimate: ${obj.cefr_estimate}`,
    });
  }

  // frequency_tier
  if (!VALID_TIER.has(obj.frequency_tier)) {
    errors.push({
      line: lineNumber,
      code: 'BAD_TIER',
      message: `invalid frequency_tier: ${obj.frequency_tier}`,
    });
  }

  // rationale_short
  if (typeof obj.rationale_short !== 'string') {
    errors.push({
      line: lineNumber,
      code: 'BAD_RATIONALE',
      message: 'rationale_short must be string',
    });
  } else {
    if (obj.rationale_short.length > 80) {
      errors.push({
        line: lineNumber,
        code: 'RATIONALE_TOO_LONG',
        message: `rationale_short > 80 chars (${obj.rationale_short.length})`,
      });
    }
    const lower = obj.rationale_short.toLowerCase();
    for (const term of BRAND_DENYLIST) {
      if (lower.includes(term.toLowerCase())) {
        errors.push({
          line: lineNumber,
          code: 'FORBIDDEN_BRAND',
          message: `rationale_short contains forbidden brand term: ${term}`,
        });
        break;
      }
    }
  }

  // confidence
  if (
    typeof obj.confidence !== 'number' ||
    obj.confidence < 0 ||
    obj.confidence > 1
  ) {
    errors.push({
      line: lineNumber,
      code: 'BAD_CONFIDENCE',
      message: `confidence out of [0,1]: ${obj.confidence}`,
    });
  }

  return { errors, item: obj };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    exitWith(1, {
      ok: false,
      error: 'usage: node 01c-validate-seed-list.mjs <path>',
    });
  }
  const inputPath = path.resolve(arg);

  const { buf, text } = readFileSafe(inputPath);
  const { hasBom, hasCrlf } = checkEncoding(buf, text);

  if (hasBom) {
    exitWith(2, {
      ok: false,
      error: 'UTF-8 BOM detected — must be without BOM',
      path: inputPath,
    });
  }
  if (hasCrlf) {
    exitWith(2, {
      ok: false,
      error: 'CRLF detected — must be LF only',
      path: inputPath,
    });
  }

  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  let totalPassed = 0;
  let totalFailed = 0;
  const allErrors = [];
  const cefrDistribution = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  let confidenceSum = 0;
  let confidenceCount = 0;
  const seenLemmaPos = new Map();

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const { errors, item } = validateLine(line, lineNumber);

    if (errors.length > 0 || item === null) {
      allErrors.push(...errors);
      totalFailed += 1;
      return;
    }

    // 중복 검사
    const key = `${item.lemma}|${item.pos}`;
    if (seenLemmaPos.has(key)) {
      allErrors.push({
        line: lineNumber,
        code: 'DUPLICATE',
        message: `duplicate (lemma, pos): ${key}, first seen at line ${seenLemmaPos.get(key)}`,
      });
      totalFailed += 1;
      return;
    }
    seenLemmaPos.set(key, lineNumber);

    cefrDistribution[item.cefr_estimate] += 1;
    confidenceSum += item.confidence;
    confidenceCount += 1;
    totalPassed += 1;
  });

  const confidenceAvg =
    confidenceCount > 0
      ? Math.round((confidenceSum / confidenceCount) * 1000) / 1000
      : 0;

  const report = {
    ok: totalFailed === 0,
    input_path: inputPath,
    total_input: lines.length,
    total_passed: totalPassed,
    total_failed: totalFailed,
    cefr_distribution: cefrDistribution,
    confidence_avg: confidenceAvg,
    encoding: { hasBom, hasCrlf },
    errors: allErrors.slice(0, 100),
    error_truncated: allErrors.length > 100,
  };

  const outputPath = inputPath.replace(/\.jsonl$/, '.validation.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', {
    encoding: 'utf8',
  });

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        summary: {
          total: lines.length,
          passed: totalPassed,
          failed: totalFailed,
          confidence_avg: confidenceAvg,
        },
        validation_report: outputPath,
      },
      null,
      2
    )
  );

  process.exit(report.ok ? 0 : 3);
}

main();
