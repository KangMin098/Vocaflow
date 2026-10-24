#!/usr/bin/env node
// docs/research/csat-learning-eval-20261024/tool/cli.mjs
// 사용: node cli.mjs <validate|score|agree|disagree|review-html|compare|check> --in file.json [--rubric r.json] [--map m.json] [--out out] [--seed N] [--iterations N] [--all] [--generated-at ISO]

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateDataset, loadRecords } from './schema.mjs';
import { scoreRecords } from './score.mjs';
import { agreementReport } from './agreement.mjs';
import { listDisagreements } from './disagreements.mjs';
import { renderReviewHtml } from './review.mjs';
import { compare } from './compare.mjs';
import { runChecks } from './checks.mjs';

const COMMANDS = ['validate', 'score', 'agree', 'disagree', 'review-html', 'compare', 'check'];

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Error(`알 수 없는 인자: ${a}`);
    const k = a.slice(2);
    if (k === 'all') { opts.all = true; continue; }
    const v = rest[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`--${k} 값이 필요`);
    opts[k] = v;
    i += 1;
  }
  return { cmd, opts };
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** 명령 실행 → {code, output(문자열)} */
export function run(argv) {
  const { cmd, opts } = parseArgs(argv);
  if (!COMMANDS.includes(cmd)) throw new Error(`명령: ${COMMANDS.join('|')}`);
  if (!opts.in) throw new Error('--in 이 필요');
  const input = readJson(opts.in);
  const map = opts.map ? readJson(opts.map) : null;
  if (cmd === 'validate') {
    const v = validateDataset(input);
    return { code: v.ok ? 0 : 1, output: JSON.stringify({ ok: v.ok, count: v.count, errors: v.errors, warnings: v.warnings }, null, 2) };
  }
  const v = validateDataset(input);
  if (!v.ok) return { code: 1, output: JSON.stringify({ ok: false, errors: v.errors }, null, 2) };
  const records = loadRecords(input);
  let result;
  if (cmd === 'score') {
    if (!opts.rubric) throw new Error('score 는 --rubric 이 필요');
    result = { status: 'SUGGESTION', note: '제안일 뿐 최종 판정이 아니다', results: scoreRecords(records, { rubric: readJson(opts.rubric), exposureMap: map }) };
  } else if (cmd === 'agree') {
    result = agreementReport(records, { raterA: opts['rater-a'], raterB: opts['rater-b'], seed: opts.seed ? Number(opts.seed) : 20261024, iterations: opts.iterations ? Number(opts.iterations) : 1000 });
  } else if (cmd === 'disagree') {
    result = listDisagreements(records, { exposureMap: map });
  } else if (cmd === 'review-html') {
    const html = renderReviewHtml(listDisagreements(records, { exposureMap: map }), { generatedAt: opts['generated-at'] || null });
    return { code: 0, output: html };
  } else if (cmd === 'compare') {
    result = compare(records, { independentOnly: !opts.all, exposureMap: map });
  } else {
    result = runChecks(records, { exposureMap: map });
  }
  return { code: 0, output: JSON.stringify(result, null, 2) };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const argv = process.argv.slice(2);
    const { opts } = parseArgs(argv);
    const r = run(argv);
    if (opts.out) writeFileSync(opts.out, r.output, 'utf8');
    else process.stdout.write(`${r.output}\n`);
    process.exitCode = r.code;
  } catch (err) {
    process.stderr.write(`오류: ${err.message}\n`);
    process.exitCode = 2;
  }
}
