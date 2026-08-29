// scripts/textbook-corpus/extract.mjs
// 2단계 — 페이지 단위 텍스트 추출.
//
// PDF 는 pdftotext(-layout) 로 뽑고 폼피드(\f)로 페이지를 가른다. 페이지를 보존하는
// 이유: 교재 비교의 단위가 "권" 이 아니라 "단원/지문" 이고, 그건 페이지에 붙어 있다.
// 한 덩어리 텍스트로 만들면 다시 쪼갤 수 없다.
//
// 재실행 안전: manifest 의 문서 해시와 meta.json 의 해시가 같으면 건너뛴다.
// 텍스트 레이어가 없는 스캔본은 실패가 아니라 status='scanned' 로 **명시 기록**한다 —
// 조용히 빈 파일을 남기면 다음 실행이 "완료" 로 세어 구멍이 영영 남는다.
//
//   node extract.mjs               미처리분만
//   node extract.mjs --force       전부 다시
//   node extract.mjs --only <id>   문서 하나만
//   node extract.mjs --limit 5     앞 5건만 (점검용)

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureDir, flagValue, fmtBytes, hasFlag, loadSources, log,
  readJson, storePaths, writeJson,
} from './lib.mjs';
import { extractHwpText } from './hwp.mjs';

const FORCE = hasFlag('--force');
const ONLY = flagValue('--only');
const LIMIT = Number(flagValue('--limit', '0')) || 0;
const CONCURRENCY = Number(flagValue('--jobs', '4')) || 4;

/** 페이지 텍스트가 이보다 짧으면 그 페이지는 이미지(스캔)로 본다. */
const MIN_CHARS_PER_PAGE = 40;
/** 문서 전체 평균이 이보다 낮으면 텍스트 레이어가 없는 스캔본이다. */
const SCANNED_AVG_CHARS = 25;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', (e) => resolve({ code: -1, err: e.message }));
    p.on('close', (code) => resolve({ code, err }));
  });
}

function countStats(text) {
  const ko = (text.match(/[가-힣]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  return { chars: text.length, ko, en, digits };
}

async function extractPdf(doc, outDir) {
  const tmp = path.join(os.tmpdir(), `tbc-${doc.id}.txt`);
  const r = await run('pdftotext', [
    '-enc', 'UTF-8', '-eol', 'unix', '-layout', doc.absPath, tmp,
  ]);
  if (r.code !== 0 && !fs.existsSync(tmp)) {
    return { status: 'failed', error: (r.err || `exit ${r.code}`).trim().slice(0, 500) };
  }
  const raw = fs.readFileSync(tmp, 'utf8');
  fs.rmSync(tmp, { force: true });

  const pages = raw.split('\f');
  if (pages.length > 1 && pages.at(-1).trim() === '') pages.pop();

  const lines = [];
  let totalChars = 0; let emptyPages = 0;
  const agg = { chars: 0, ko: 0, en: 0, digits: 0 };

  pages.forEach((text, i) => {
    const t = text.replace(/[ \t]+$/gm, '').replace(/\n{4,}/g, '\n\n\n');
    const s = countStats(t);
    totalChars += s.chars;
    agg.chars += s.chars; agg.ko += s.ko; agg.en += s.en; agg.digits += s.digits;
    if (s.chars < MIN_CHARS_PER_PAGE) emptyPages += 1;
    lines.push(JSON.stringify({ p: i + 1, ...s, text: t }));
  });

  const avg = pages.length ? totalChars / pages.length : 0;
  const status = avg < SCANNED_AVG_CHARS ? 'scanned' : 'ok';

  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'pages.jsonl'), `${lines.join('\n')}\n`, 'utf8');

  return {
    status,
    pages: pages.length,
    emptyPages,
    avgCharsPerPage: Math.round(avg),
    totals: agg,
    note: status === 'scanned'
      ? '텍스트 레이어 없음 — OCR 필요 (ocr-queue.md 에 올라간다)'
      : null,
  };
}

function extractHtml(doc, outDir) {
  const raw = fs.readFileSync(doc.absPath, 'utf8');
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const s = countStats(text);
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'pages.jsonl'), `${JSON.stringify({ p: 1, ...s, text })}\n`, 'utf8');
  return {
    status: 'ok', pages: 1, emptyPages: 0, avgCharsPerPage: s.chars,
    totals: s, note: 'HTML 은 페이지 개념이 없어 1페이지로 담는다',
  };
}

/**
 * HWP 는 고정 페이지 경계가 스트림에 없다. 문단 경계에서 ~3,000자로 끊어
 * 유사 페이지를 만들되 meta 에 pageKind='chunk' 로 적어 진짜 쪽번호와 헷갈리지 않게 한다.
 */
function extractHwp(doc, outDir) {
  const r = extractHwpText(fs.readFileSync(doc.absPath));
  if (!r.ok) {
    return {
      status: 'failed', pages: 0, emptyPages: 0, avgCharsPerPage: 0,
      totals: { chars: 0, ko: 0, en: 0, digits: 0 }, error: r.reason,
    };
  }
  const CHUNK = 3000;
  const chunks = [];
  for (const section of r.sections) {
    let buf = '';
    for (const para of section.split('\n')) {
      if (buf.length + para.length > CHUNK && buf.length > 0) { chunks.push(buf.trim()); buf = ''; }
      buf += `${para}\n`;
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  const agg = { chars: 0, ko: 0, en: 0, digits: 0 };
  const lines = chunks.map((text, i) => {
    const s = countStats(text);
    agg.chars += s.chars; agg.ko += s.ko; agg.en += s.en; agg.digits += s.digits;
    return JSON.stringify({ p: i + 1, ...s, text });
  });
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'pages.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  return {
    status: 'ok',
    pageKind: 'chunk',
    pages: chunks.length,
    emptyPages: 0,
    avgCharsPerPage: chunks.length ? Math.round(agg.chars / chunks.length) : 0,
    totals: agg,
    hwpVersion: r.version,
    note: 'HWP 5.0 직접 파싱 — 표·글상자 안 글은 빠질 수 있다. 쪽 구분은 3,000자 청크이지 실제 쪽이 아니다',
  };
}

function unsupported(doc) {
  return {
    status: 'unsupported',
    pages: 0, emptyPages: 0, avgCharsPerPage: 0,
    totals: { chars: 0, ko: 0, en: 0, digits: 0 },
    note: `.${doc.ext} 를 읽는 도구가 이 환경에 없다 — hwp 는 한글/LibreOffice 변환이 필요하다`,
  };
}

async function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const manifest = readJson(sp.manifest, null);
  if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }

  let docs = Object.values(manifest.docs);
  if (ONLY) docs = docs.filter((d) => d.id === ONLY);
  // `unsupported`·`failed` 는 완료가 아니다 — 도구가 생기면 다시 시도해야 한다.
  // `scanned` 는 OCR 이 붙기 전까지 재시도해도 결과가 같으므로 완료로 둔다.
  const RETRY = new Set(['unsupported', 'failed']);
  const todo = docs.filter((d) => FORCE
    || !d.extract
    || d.extract.sourceHash !== d.hash
    || RETRY.has(d.extract.status));
  const work = LIMIT ? todo.slice(0, LIMIT) : todo;

  log(`대상 ${docs.length} · 처리할 것 ${todo.length}${LIMIT ? ` (이번 ${work.length})` : ''}`);
  if (work.length === 0) { log('할 일 없음 — 모두 최신.'); return; }

  const startedAt = Date.now();
  let done = 0;
  const results = new Map();

  async function handle(doc) {
    const outDir = path.join(sp.text, doc.id);
    const t0 = Date.now();
    let res;
    try {
      if (doc.ext === 'pdf') res = await extractPdf(doc, outDir);
      else if (doc.ext === 'html' || doc.ext === 'htm' || doc.ext === 'txt') res = extractHtml(doc, outDir);
      else if (doc.ext === 'hwp') res = extractHwp(doc, outDir);
      else res = unsupported(doc);
    } catch (e) {
      res = {
        status: 'failed', pages: 0, emptyPages: 0, avgCharsPerPage: 0,
        totals: { chars: 0, ko: 0, en: 0, digits: 0 }, error: String(e).slice(0, 500),
      };
    }
    res.sourceHash = doc.hash;
    res.extractedAt = new Date().toISOString();
    res.ms = Date.now() - t0;
    if (res.status !== 'unsupported' && res.status !== 'failed') {
      writeJson(path.join(outDir, 'meta.json'), { id: doc.id, relPath: doc.relPath, ...res });
    }
    results.set(doc.id, res);
    done += 1;
    const mark = { ok: '✓', scanned: '▲', failed: '✗', unsupported: '−' }[res.status] || '?';
    log(`  ${mark} [${String(done).padStart(3)}/${work.length}] ${res.pages}p ${fmtBytes(res.totals.chars)} ${(res.ms / 1000).toFixed(1)}s  ${doc.relPath}`);
  }

  const queue = [...work];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const doc = queue.shift();
      if (!doc) return;
      await handle(doc);
    }
  }));

  for (const [id, res] of results) manifest.docs[id].extract = res;
  manifest.extractedAt = new Date().toISOString();
  writeJson(sp.manifest, manifest);

  const by = {};
  for (const d of Object.values(manifest.docs)) {
    const s = d.extract?.status || 'pending';
    by[s] = (by[s] || 0) + 1;
  }
  const pages = Object.values(manifest.docs).reduce((a, d) => a + (d.extract?.pages || 0), 0);
  const chars = Object.values(manifest.docs).reduce((a, d) => a + (d.extract?.totals?.chars || 0), 0);
  log(`\n상태: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  log(`페이지 ${pages.toLocaleString()} · 문자 ${chars.toLocaleString()} · ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
}

main();
