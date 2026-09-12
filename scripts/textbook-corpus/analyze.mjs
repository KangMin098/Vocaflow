// scripts/textbook-corpus/analyze.mjs
// 3단계 — 문서별 분석 지표 산출.
//
// 왜 필요한가: 교재를 "비교" 하려면 학년 라벨 말고 **측정된 축**이 있어야 한다.
// 출판사가 붙인 "중2 수준" 은 서로 다른 자를 쓴 값이라 비교가 안 된다. 여기서는
// 본문 영어만 골라 문장 길이 · 음절 · 어휘 다양도 · Flesch-Kincaid 학년을 실제로 잰다.
//
// 한계를 분명히 적는다:
//  - pdftotext -layout 결과에는 머리말·쪽번호·해설 한국어가 섞인다. 영어 우세 줄만 남겨
//    본문에 가깝게 만들지만 완전히 걸러지지는 않는다.
//  - FK 지수는 영어 원어민 학년 척도다. 한국 학년과 1:1 대응이 아니라 **교재 간 상대 비교**용이다.
//
//   node analyze.mjs            미분석분만
//   node analyze.mjs --force    전부 다시

import fs from 'node:fs';
import path from 'node:path';
import {
  flagValue, hasFlag, loadSources, log, readJson, storePaths, writeJson,
} from './lib.mjs';

const FORCE = hasFlag('--force');
const ONLY = flagValue('--only');

/** 영어 본문으로 볼 줄의 최소 조건 — 알파벳이 한글보다 많고 충분히 길다. */
function englishLines(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const en = (line.match(/[A-Za-z]/g) || []).length;
    const ko = (line.match(/[가-힣]/g) || []).length;
    if (en >= 20 && en > ko * 2) out.push(line.trim());
  }
  return out;
}

/** 음절 근사 — 모음군 개수. 끝의 묵음 e 와 -le 예외를 다룬다. */
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

const STOP = new Set(('the of and a to in is you that it he was for on are as with his they i at be this have from '
  + 'or one had by word but not what all were we when your can said there use an each which she do how their if '
  + 'will up other about out many then them these so some her would make like him into time has look two more '
  + 'write go see number no way could people my than first been call who its now find long down day did get come '
  + 'made may part over new sound take only little work know place year live me back give most very after thing '
  + 'our just name good sentence man think say great where help through much before line right too mean old any '
  + 'same tell boy follow came want show also around form three small set put end does another well large must '
  + 'big even such because turn here why ask went men read need land different home us move try kind hand picture '
  + 'again change off play spell air away animal house point page letter mother answer found study still learn '
  + 'should america world').split(' '));

/**
 * 지문 겹침 지문(sketch) — 8낱말 연속열을 해시해 1/64 만 남긴다.
 *
 * 왜 어휘 집합이 아니라 연속열인가: 같은 학년대 교재는 어휘가 원래 비슷하다.
 * "같은 책의 다른 판본/미리보기" 를 가리려면 **같은 문장이 실제로 들어 있는지**를
 * 물어야 한다. 8낱말이면 우연히 겹치지 않는다.
 */
function shingleSketch(enWords, k = 8, keepEvery = 64) {
  const out = [];
  for (let i = 0; i + k <= enWords.length; i += 1) {
    // FNV-1a 32비트 — 빠르고 분포가 고르다.
    let h = 0x811c9dc5;
    for (let j = i; j < i + k; j += 1) {
      const w = enWords[j];
      for (let c = 0; c < w.length; c += 1) {
        h ^= w.charCodeAt(c);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      h ^= 32;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    if (h % keepEvery === 0) out.push(h);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function analyzeDoc(pagesPath) {
  const lines = fs.readFileSync(pagesPath, 'utf8').split('\n').filter(Boolean);
  let enText = [];
  const unitHits = [];
  let pages = 0;

  for (const raw of lines) {
    let page;
    try { page = JSON.parse(raw); } catch { continue; }
    pages += 1;
    const t = page.text || '';
    enText.push(...englishLines(t));

    for (const m of t.matchAll(/\b(UNIT|Unit|CHAPTER|Chapter|LESSON|Lesson|PART|Part|DAY|Day|WEEK|Week|SECTION|Section)\s*[.:]?\s*(\d{1,3})\b/g)) {
      unitHits.push({ page: page.p, kind: m[1].toUpperCase(), no: Number(m[2]) });
    }
  }

  const body = enText.join(' ');
  const sentences = (body.match(/[.!?]["')\]]*(\s|$)/g) || []).length;
  const words = body.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  const wordCount = words.length;

  const freq = new Map();
  let syl = 0;
  let longWords = 0;
  for (const w of words) {
    const lc = w.toLowerCase();
    const s = syllables(lc);
    syl += s;
    if (s >= 3) longWords += 1;
    if (!STOP.has(lc) && lc.length > 2) freq.set(lc, (freq.get(lc) || 0) + 1);
  }

  const types = new Set(words.map((w) => w.toLowerCase())).size;
  const avgSentenceLen = sentences ? wordCount / sentences : 0;
  const sylPerWord = wordCount ? syl / wordCount : 0;
  const fk = sentences && wordCount
    ? 0.39 * avgSentenceLen + 11.8 * sylPerWord - 15.59
    : null;
  // Fog 지수 — 3음절 이상 낱말 비중을 본다. FK 와 함께 보면 한쪽 잡음을 잡아낸다.
  const fog = sentences && wordCount
    ? 0.4 * (avgSentenceLen + 100 * (longWords / wordCount))
    : null;

  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([w, n]) => ({ w, n }));

  // 단원 목차 — 같은 종류 중 가장 많이 나온 표기를 정본으로 삼고 첫 등장 페이지를 남긴다.
  const kindCount = {};
  for (const u of unitHits) kindCount[u.kind] = (kindCount[u.kind] || 0) + 1;
  const primaryKind = Object.entries(kindCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const unitFirstPage = new Map();
  for (const u of unitHits) {
    if (u.kind !== primaryKind) continue;
    if (!unitFirstPage.has(u.no)) unitFirstPage.set(u.no, u.page);
  }
  const units = [...unitFirstPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([no, page]) => ({ no, page }));

  return {
    pages,
    englishLines: enText.length,
    wordTokens: wordCount,
    wordTypes: types,
    ttr: wordCount ? Number((types / wordCount).toFixed(4)) : 0,
    sentences,
    avgSentenceLen: Number(avgSentenceLen.toFixed(2)),
    sylPerWord: Number(sylPerWord.toFixed(3)),
    longWordRatio: wordCount ? Number((longWords / wordCount).toFixed(4)) : 0,
    fkGrade: fk === null ? null : Number(fk.toFixed(2)),
    fogIndex: fog === null ? null : Number(fog.toFixed(2)),
    unitKind: primaryKind,
    unitCount: units.length,
    units: units.slice(0, 200),
    topWords,
    sketch: shingleSketch(words.map((w) => w.toLowerCase())),
  };
}

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const manifest = readJson(sp.manifest, null);
  if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }

  let docs = Object.values(manifest.docs);
  if (ONLY) docs = docs.filter((d) => d.id === ONLY);

  let done = 0; let skipped = 0; let noText = 0;
  for (const doc of docs) {
    const pagesPath = path.join(sp.text, doc.id, 'pages.jsonl');
    if (!fs.existsSync(pagesPath)) { noText += 1; continue; }
    // 원본 해시만 보면 안 된다 — 원본이 그대로여도 추출이 좋아지면(OCR 교정 규칙 수정 등)
    // 본문이 바뀐다. 그때 여기서 건너뛰면 지표가 낡은 본문에 머문 채 조용히 남는다.
    if (!FORCE
      && doc.analysis?.sourceHash === doc.hash
      && doc.analysis?.extractedAt === doc.extract?.extractedAt) { skipped += 1; continue; }
    const a = analyzeDoc(pagesPath);
    a.sourceHash = doc.hash;
    a.extractedAt = doc.extract?.extractedAt || null;
    a.analyzedAt = new Date().toISOString();
    manifest.docs[doc.id].analysis = a;
    done += 1;
  }

  manifest.analyzedAt = new Date().toISOString();
  writeJson(sp.manifest, manifest);
  log(`분석 ${done} · 최신이라 건너뜀 ${skipped} · 텍스트 없음 ${noText}`);

  const withFk = Object.values(manifest.docs).filter((d) => d.analysis?.fkGrade != null);
  log(`FK 산출 ${withFk.length} 문서 · 중앙값 ${median(withFk.map((d) => d.analysis.fkGrade)).toFixed(2)}`);
}

function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

main();
