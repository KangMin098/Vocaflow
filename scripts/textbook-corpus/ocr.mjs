// scripts/textbook-corpus/ocr.mjs
// 스캔 PDF 를 Windows 내장 OCR 로 읽고, 인식 오류를 코퍼스 자체 어휘로 교정한다.
//
// 왜 자체 어휘인가: 이 환경에 영어 사전 파일이 없고, 설치된 인식기도 한국어뿐이라
// 라틴 문자에서 `only→이11y` · `of→0f` 같은 숫자 혼동이 규칙적으로 난다.
// 그런데 이미 **깨끗하게 추출된 76개 문서에 1,400만 자**가 있다 — 같은 출판사,
// 같은 장르, 같은 어휘대다. 여기서 3회 이상 나온 낱말을 사전으로 삼으면
// 외부 의존 없이 "고친 형태가 실제로 이 바닥에서 쓰이는 낱말인가" 를 물을 수 있다.
//
// 교정은 **사전에 있는 형태로 바뀔 때만** 적용한다. 아니면 원본을 그대로 둔다 —
// 근거 없는 교정은 오류를 지우는 게 아니라 다른 오류로 바꾸는 것이다.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, ensureDir } from './lib.mjs';

/** 한국어 인식기가 라틴 문자에서 자주 내는 혼동. 좌→우로 되돌린다. */
const CONFUSIONS = {
  0: ['o', 'O', 'D'],
  1: ['l', 'i', 'I', 't'],
  2: ['z', 'Z'],
  3: ['e', 'E'],
  4: ['a', 'A'],
  5: ['s', 'S'],
  6: ['b', 'G'],
  7: ['t', 'T'],
  8: ['B', 'g'],
  9: ['g', 'q'],
};

/**
 * 깨끗하게 추출된 문서들에서 검증용 어휘를 만든다.
 * @param {string} textDir store 의 text 디렉터리
 * @param {string[]} okDocIds status==='ok' 인 문서 id
 * @param {number} minCount 이 횟수 이상 나온 낱말만 (오탈자 유입 차단)
 */
export function buildVocabulary(textDir, okDocIds, minCount = 3) {
  const counts = new Map();
  for (const id of okDocIds) {
    const p = path.join(textDir, id, 'pages.jsonl');
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line) continue;
      let pg;
      try { pg = JSON.parse(line); } catch { continue; }
      for (const w of pg.text.match(/[A-Za-z]{2,}(?:['’][A-Za-z]{1,2})?/g) || []) {
        const lc = w.toLowerCase().replace(/[’]/g, "'");
        counts.set(lc, (counts.get(lc) || 0) + 1);
      }
    }
  }
  const vocab = new Set();
  for (const [w, n] of counts) if (n >= minCount) vocab.add(w);
  return vocab;
}

/** 후보를 만든다 — 낱말 안의 숫자를 혼동표대로 바꾼 모든 조합(최대 64개). */
function candidates(token) {
  let out = [token];
  for (let i = 0; i < token.length; i += 1) {
    const alts = CONFUSIONS[token[i]];
    if (!alts) continue;
    const next = [];
    for (const base of out) {
      for (const a of alts) next.push(base.slice(0, i) + a + base.slice(i + 1));
      if (next.length > 64) break;
    }
    out = next.length ? next : out;
    if (out.length > 64) break;
  }
  return out;
}

/**
 * 한 쪽의 OCR 텍스트를 교정한다.
 * @returns {{text:string, repaired:number, seen:number}}
 */
export function repairText(text, vocab) {
  let repaired = 0; let seen = 0;
  const out = text.replace(/[A-Za-z0-9'’]{2,}/g, (tok) => {
    // 글자와 숫자가 섞인 토큰만 본다. 순수 숫자(쪽번호·연도)는 건드리지 않는다.
    if (!/[A-Za-z]/.test(tok) || !/[0-9]/.test(tok)) return tok;
    // 교재의 권 표기(`L2` · `B1` · `A4`)는 오인식이 아니라 진짜 코드다 — 건드리면 안 된다.
    if (/^[A-Z][0-9]{1,2}$/.test(tok)) return tok;
    // 글자보다 숫자가 **더** 많으면 코드일 가능성이 크다. 같은 수(`t0` · `0f`)는 고친다 —
    // 여기서 `>=` 로 막으면 가장 흔한 오인식이 통째로 빠져나간다(교정률 42% → 6.7% 로 갈렸다).
    const letters = (tok.match(/[A-Za-z]/g) || []).length;
    const digits = (tok.match(/[0-9]/g) || []).length;
    if (digits > letters) return tok;
    seen += 1;
    for (const c of candidates(tok)) {
      if (c === tok) continue;
      if (vocab.has(c.toLowerCase().replace(/[’]/g, "'"))) { repaired += 1; return c; }
    }
    return tok;
  });
  return { text: out, repaired, seen };
}

/**
 * 스캔 PDF 한 건을 OCR 한다. 쪽 단위 .txt 를 남기므로 중간에 끊겨도 이어서 돈다.
 * @returns {{pages:string[], ocrDir:string}}
 */
export function ocrPdf(absPath, workDir, { scale = 3.5, lang = 'ko' } = {}) {
  ensureDir(workDir);
  execFileSync('powershell', [
    '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'ocr-win.ps1'),
    '-Pdf', absPath, '-OutDir', workDir, '-Scale', String(scale), '-Lang', lang,
  ], { stdio: 'ignore', timeout: 60 * 60 * 1000 });

  const files = fs.readdirSync(workDir).filter((f) => /^page-\d{4}\.txt$/.test(f)).sort();
  return {
    ocrDir: workDir,
    pages: files.map((f) => fs.readFileSync(path.join(workDir, f), 'utf8')),
  };
}
