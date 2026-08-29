// scripts/textbook-corpus/build-md.mjs
// 5단계 — 사람이 읽는 면(md) 생성.
//
// 역할 나누기: DB 는 전량 조회·교차 질의를 맡고, md 는 "훑어보고 판단하는" 면을 맡는다.
// 그래서 문서 카드에는 원문 전량이 아니라 **판단에 필요한 것**만 넣는다 —
// 분류 축 · 측정 지표 · 단원 목차 · 빈출 어휘 · 대표 발췌 · 원문 조회법.
// 전량 md 가 필요하면 --full 로 따로 뽑는다(합계 14 MB 남짓).
//
// 산출물은 매번 통째로 다시 만든다. 파생물을 손으로 고치면 다음 실행에 지워진다 —
// 고칠 것은 overrides.json 이나 taxonomy.mjs 다.
//
//   node build-md.mjs
//   node build-md.mjs --full     원문 전량 md 도 함께

import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, fmtBytes, hasFlag, loadSources, log, readJson, safeSlug, storePaths, writeText,
} from './lib.mjs';

const FULL = hasFlag('--full');

const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));
const int = (v) => (v == null ? '—' : Number(v).toLocaleString());

function cardPath(doc) {
  const school = doc.school.replace(/~/g, '-');
  return path.join(school, `${safeSlug(doc.fileName)}__${doc.id}.md`);
}

function readPages(sp, id) {
  const p = path.join(sp.text, id, 'pages.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function docCard(doc, pages, sp) {
  const e = doc.extract || {};
  const a = doc.analysis || {};
  const t = e.totals || {};
  const L = [];

  L.push(`# ${doc.fileName}`);
  L.push('');
  L.push(`> \`${doc.id}\` · ${doc.series} · ${doc.grade_band} · ${doc.category} · ${doc.role}`);
  L.push('');

  L.push('## 분류');
  L.push('');
  L.push('| 축 | 값 |');
  L.push('|---|---|');
  L.push(`| 학교급 | ${doc.school} |`);
  L.push(`| 학년대 | ${doc.grade_band}${doc.grade_min != null ? ` (눈금 ${doc.grade_min}–${doc.grade_max})` : ''} |`);
  L.push(`| 유형 | ${doc.category} |`);
  L.push(`| 역할 | ${doc.role} |`);
  L.push(`| 출판사 | ${doc.publisher} |`);
  L.push(`| 시리즈 | ${doc.series}${doc.volume != null ? ` · ${doc.volume}권` : ''} |`);
  if (doc.evidence) L.push(`| 근거 | ${doc.evidence} |`);
  if (doc.low_confidence?.length) L.push(`| ⚠ 미확정 | ${doc.low_confidence.join(', ')} |`);
  if (doc.defaults?.length) L.push(`| 기본값 사용 | ${doc.defaults.join(', ')} |`);
  L.push(`| 판정 규칙 | \`${(doc.rules || []).join('` `')}\` |`);
  L.push('');

  L.push('## 원본');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| 경로 | \`${doc.relPath}\` |`);
  L.push(`| 출처 | ${doc.rootLabel} |`);
  L.push(`| 형식 · 용량 | ${doc.ext.toUpperCase()} · ${fmtBytes(doc.size)} |`);
  L.push(`| 내용 해시 | \`${doc.hash.slice(0, 16)}\` |`);
  L.push('');

  L.push('## 추출');
  L.push('');
  const statusLabel = { ok: '✅ 정상', scanned: '▲ 스캔본(텍스트 레이어 없음)', failed: '✗ 실패', unsupported: '− 미지원', pending: '· 대기' }[e.status] || e.status;
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| 상태 | ${statusLabel} |`);
  L.push(`| 쪽수 | ${int(e.pages)}${e.pageKind === 'chunk' ? ' (실제 쪽이 아니라 3,000자 청크)' : ''} |`);
  L.push(`| 문자 | ${int(t.chars)} (한글 ${int(t.ko)} · 영문 ${int(t.en)}) |`);
  L.push(`| 영문 비중 | ${t.chars ? `${((t.en / t.chars) * 100).toFixed(1)}%` : '—'} |`);
  if (e.emptyPages) L.push(`| 빈 쪽 | ${e.emptyPages} |`);
  if (e.note) L.push(`| 비고 | ${e.note} |`);
  L.push('');

  if (a.fkGrade != null) {
    L.push('## 측정 지표');
    L.push('');
    L.push('영어 우세 줄만 골라 잰 값이다. 머리말·해설 한국어가 일부 섞일 수 있으므로 **교재 간 상대 비교**로 쓴다.');
    L.push('');
    L.push('| 지표 | 값 | 읽는 법 |');
    L.push('|---|---:|---|');
    L.push(`| Flesch-Kincaid 학년 | ${num(a.fkGrade, 2)} | 미국 학년 척도. 높을수록 어렵다 |`);
    L.push(`| Gunning Fog | ${num(a.fogIndex, 2)} | 3음절 이상 낱말 비중 반영 |`);
    L.push(`| 평균 문장 길이 | ${num(a.avgSentenceLen, 1)} 낱말 | |`);
    L.push(`| 낱말당 음절 | ${num(a.sylPerWord, 3)} | |`);
    L.push(`| 어휘 다양도(TTR) | ${num(a.ttr, 4)} | 타입/토큰. 분량이 짧을수록 커진다 |`);
    L.push(`| 낱말 토큰 · 타입 | ${int(a.wordTokens)} · ${int(a.wordTypes)} | |`);
    L.push(`| 문장 수 | ${int(a.sentences)} | |`);
    L.push('');
  }

  if (a.units?.length) {
    L.push(`## 단원 목차 (${a.unitKind} ${a.unitCount}개 감지)`);
    L.push('');
    L.push('| 단원 | 첫 등장 쪽 |');
    L.push('|---:|---:|');
    for (const u of a.units.slice(0, 60)) L.push(`| ${u.no} | ${u.page} |`);
    if (a.units.length > 60) L.push(`| … | 외 ${a.units.length - 60}개 |`);
    L.push('');
  }

  if (a.topWords?.length) {
    L.push('## 빈출 어휘 (기능어 제외 상위 30)');
    L.push('');
    L.push(a.topWords.slice(0, 30).map((w) => `\`${w.w}\` ${w.n}`).join(' · '));
    L.push('');
  }

  if (pages.length) {
    L.push('## 쪽별 밀도');
    L.push('');
    L.push('| 쪽 | 문자 | 한글 | 영문 | 첫 줄 |');
    L.push('|---:|---:|---:|---:|---|');
    for (const p of pages.slice(0, 40)) {
      const head = (p.text.split('\n').find((l) => l.trim().length > 3) || '').trim().replace(/\|/g, '\\|').slice(0, 60);
      L.push(`| ${p.p} | ${p.chars} | ${p.ko} | ${p.en} | ${head} |`);
    }
    if (pages.length > 40) L.push(`| … | | | | 외 ${pages.length - 40}쪽 — 전량은 DB \`pages\` 표 |`);
    L.push('');

    const best = [...pages].sort((a2, b2) => b2.en - a2.en)[0];
    if (best && best.en > 200) {
      L.push(`## 대표 발췌 (영문 밀도 최고 — ${best.p}쪽)`);
      L.push('');
      L.push('```text');
      L.push(best.text.split('\n').filter((l) => l.trim()).slice(0, 28).join('\n').slice(0, 1600));
      L.push('```');
      L.push('');
    }
  }

  L.push('## 원문 전량 보기');
  L.push('');
  L.push('```sql');
  L.push(`-- ${sp.db}`);
  L.push(`SELECT p, text FROM pages WHERE doc_id = '${doc.id}' ORDER BY p;`);
  L.push('```');
  L.push('');
  L.push(`\`\`\`bash\nnode scripts/textbook-corpus/query.mjs doc ${doc.id}\n\`\`\``);
  L.push('');
  return `${L.join('\n')}\n`;
}

function table(rows, headers, aligns) {
  const L = [`| ${headers.join(' | ')} |`];
  L.push(`|${headers.map((_, i) => (aligns?.[i] === 'r' ? '---:' : '---')).join('|')}|`);
  for (const r of rows) L.push(`| ${r.join(' | ')} |`);
  return L.join('\n');
}

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const manifest = readJson(sp.manifest, null);
  if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }

  fs.rmSync(sp.md, { recursive: true, force: true });
  fs.rmSync(sp.index, { recursive: true, force: true });
  ensureDir(sp.md); ensureDir(sp.index);

  const docs = Object.values(manifest.docs)
    .sort((a, b) => (a.grade_min ?? 99) - (b.grade_min ?? 99)
      || a.series.localeCompare(b.series)
      || (a.volume ?? 0) - (b.volume ?? 0)
      || a.fileName.localeCompare(b.fileName));

  // ── 문서 카드 ────────────────────────────────────────────────
  let cards = 0;
  for (const doc of docs) {
    const pages = readPages(sp, doc.id);
    writeText(path.join(sp.md, cardPath(doc)), docCard(doc, pages, sp));
    cards += 1;
    if (FULL) {
      const body = pages.map((p) => `\n\n---\n\n### ${p.p}쪽\n\n\`\`\`text\n${p.text}\n\`\`\``).join('');
      writeText(path.join(sp.root, 'full', cardPath(doc)), `# ${doc.fileName} — 원문 전량\n\n> \`${doc.id}\` · ${doc.series} · ${doc.grade_band} · ${pages.length}쪽\n${body}\n`);
    }
  }

  const rel = (doc) => `../md/${cardPath(doc).split(path.sep).join('/')}`;
  const link = (doc) => `[${doc.fileName}](${encodeURI(rel(doc))})`;

  const ok = docs.filter((d) => d.extract?.status === 'ok');
  const totalPages = docs.reduce((a, d) => a + (d.extract?.pages || 0), 0);
  const totalChars = docs.reduce((a, d) => a + (d.extract?.totals?.chars || 0), 0);
  const totalBytes = docs.reduce((a, d) => a + d.size, 0);

  // ── 00 커버리지 ──────────────────────────────────────────────
  const byStatus = {};
  for (const d of docs) byStatus[d.extract?.status || 'pending'] = (byStatus[d.extract?.status || 'pending'] || 0) + 1;
  writeText(path.join(sp.index, '00-coverage.md'), [
    '# 00 · 커버리지',
    '',
    `문서 **${docs.length}** · 원본 **${fmtBytes(totalBytes)}** · 추출 쪽 **${totalPages.toLocaleString()}** · 문자 **${totalChars.toLocaleString()}**`,
    '',
    '## 추출 상태',
    '',
    table(Object.entries(byStatus).map(([k, v]) => [
      { ok: '✅ ok', scanned: '▲ scanned', failed: '✗ failed', unsupported: '− unsupported', pending: '· pending' }[k] || k,
      String(v),
      `${((v / docs.length) * 100).toFixed(1)}%`,
    ]), ['상태', '문서', '비중'], ['', 'r', 'r']),
    '',
    '`scanned` 는 실패가 아니라 **텍스트 레이어가 없는 스캔 PDF** 다. OCR 이 붙기 전에는 본문을 얻을 수 없다 — [06-gaps.md](06-gaps.md) 참조.',
    '',
    '## 확장자별',
    '',
    table(
      Object.entries(docs.reduce((m, d) => ({ ...m, [d.ext]: (m[d.ext] || 0) + 1 }), {}))
        .map(([k, v]) => [k, String(v)]),
      ['확장자', '문서'], ['', 'r'],
    ),
    '',
    '## 출처별',
    '',
    table(
      Object.entries(docs.reduce((m, d) => ({ ...m, [d.rootLabel]: (m[d.rootLabel] || 0) + 1 }), {}))
        .map(([k, v]) => [k, String(v)]),
      ['출처', '문서'], ['', 'r'],
    ),
    '',
  ].join('\n'));

  // ── 01 학교급/학년 ───────────────────────────────────────────
  const bySchool = new Map();
  for (const d of docs) {
    const k = `${d.school}|${d.grade_band}`;
    if (!bySchool.has(k)) bySchool.set(k, []);
    bySchool.get(k).push(d);
  }
  const schoolLines = ['# 01 · 학교급 · 학년대별', '',
    '학년 눈금: 초1=1 … 초6=6 · 중1=7 … 중3=9 · 고1=10 … 고3=12. 라벨이 아니라 이 눈금으로 정렬한다.', ''];
  for (const [k, list] of [...bySchool.entries()].sort((a, b) => (a[1][0].grade_min ?? 99) - (b[1][0].grade_min ?? 99))) {
    const [school, band] = k.split('|');
    schoolLines.push(`## ${school} — ${band}  (${list.length}건)`, '');
    schoolLines.push(table(
      list.map((d) => [
        link(d), d.series, d.volume ?? '—', d.category, d.role,
        String(d.extract?.pages || 0), num(d.analysis?.fkGrade, 2),
      ]),
      ['파일', '시리즈', '권', '유형', '역할', '쪽', 'FK'], ['', '', 'r', '', '', 'r', 'r'],
    ), '');
  }
  writeText(path.join(sp.index, '01-by-school.md'), schoolLines.join('\n'));

  // ── 02 유형 ─────────────────────────────────────────────────
  const byCat = new Map();
  for (const d of docs) {
    if (!byCat.has(d.category)) byCat.set(d.category, []);
    byCat.get(d.category).push(d);
  }
  const catLines = ['# 02 · 유형별', ''];
  for (const [cat, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    catLines.push(`## ${cat} (${list.length}건)`, '');
    catLines.push(table(
      list.map((d) => [link(d), d.grade_band, d.series, d.role, d.publisher, String(d.extract?.pages || 0)]),
      ['파일', '학년대', '시리즈', '역할', '출판사', '쪽'], ['', '', '', '', '', 'r'],
    ), '');
  }
  writeText(path.join(sp.index, '02-by-category.md'), catLines.join('\n'));

  // ── 03 시리즈 ───────────────────────────────────────────────
  const bySeries = new Map();
  for (const d of docs) {
    if (!bySeries.has(d.series)) bySeries.set(d.series, []);
    bySeries.get(d.series).push(d);
  }
  const serLines = ['# 03 · 시리즈별', '',
    '한 시리즈 안에서 **어떤 권의 어떤 역할이 갖춰졌는지** 본다. 본책 없이 해설만 있는 권은 지문 분석이 안 된다.', ''];
  for (const [ser, list] of [...bySeries.entries()].sort((a, b) => (a[1][0].grade_min ?? 99) - (b[1][0].grade_min ?? 99) || a[0].localeCompare(b[0]))) {
    const vols = new Map();
    for (const d of list) {
      const v = d.volume ?? 0;
      if (!vols.has(v)) vols.set(v, []);
      vols.get(v).push(d);
    }
    serLines.push(`## ${ser} — ${list[0].publisher} · ${list[0].category} (${list.length}건)`, '');
    serLines.push(table(
      [...vols.entries()].sort((a, b) => a[0] - b[0]).map(([v, ds]) => {
        const has = (r) => (ds.some((d) => d.role === r) ? '✅' : '·');
        return [
          v === 0 ? '—' : String(v),
          ds.map((d) => `${d.grade_band}`).filter((x, i, arr) => arr.indexOf(x) === i).join(' / '),
          has('본책') === '✅' || ds.some((d) => d.role === '본문') ? '✅' : '·',
          has('미리보기'), has('정답해설'), has('워크북'),
          String(ds.reduce((a, d) => a + (d.extract?.pages || 0), 0)),
          ds.map((d) => link(d)).join('<br>'),
        ];
      }),
      ['권', '학년대', '본책', '미리보기', '정답해설', '워크북', '쪽', '파일'],
      ['r', '', '', '', '', '', 'r', ''],
    ), '');
  }
  writeText(path.join(sp.index, '03-by-series.md'), serLines.join('\n'));

  // ── 04 출판사 ───────────────────────────────────────────────
  const byPub = new Map();
  for (const d of docs) {
    if (!byPub.has(d.publisher)) byPub.set(d.publisher, []);
    byPub.get(d.publisher).push(d);
  }
  writeText(path.join(sp.index, '04-by-publisher.md'), [
    '# 04 · 출판사별', '',
    table(
      [...byPub.entries()].sort((a, b) => b[1].length - a[1].length).map(([p, list]) => [
        p, String(list.length),
        [...new Set(list.map((d) => d.series))].join(' · '),
        [...new Set(list.map((d) => d.category))].join(' · '),
        String(list.reduce((a, d) => a + (d.extract?.pages || 0), 0)),
      ]),
      ['출판사', '문서', '시리즈', '유형', '쪽'], ['', 'r', '', '', 'r'],
    ),
    '',
    '`미상` 은 파일명·본문에서 판권을 찾지 못한 것이다. 왜 못 찾았는지는 [06-gaps.md](06-gaps.md) 와 `overrides.json` 의 `unresolved` 에 적혀 있다.',
    '',
  ].join('\n'));

  // ── 05 난이도 ───────────────────────────────────────────────
  const measured = ok.filter((d) => d.analysis?.fkGrade != null)
    .sort((a, b) => (a.grade_min ?? 99) - (b.grade_min ?? 99) || a.analysis.fkGrade - b.analysis.fkGrade);
  const bandAgg = new Map();
  for (const d of measured) {
    const k = d.grade_band;
    if (!bandAgg.has(k)) bandAgg.set(k, { gm: d.grade_min, gx: d.grade_max, xs: [], sl: [], ttr: [] });
    const g = bandAgg.get(k);
    g.xs.push(d.analysis.fkGrade); g.sl.push(d.analysis.avgSentenceLen); g.ttr.push(d.analysis.ttr);
  }
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  writeText(path.join(sp.index, '05-difficulty.md'), [
    '# 05 · 난이도 비교', '',
    '출판사가 붙인 학년 라벨은 서로 다른 자로 잰 값이라 그대로 비교할 수 없다. 여기서는 **본문 영어를 직접 재서** 나란히 놓는다.',
    '',
    '측정 방법: 영문자가 한글의 2배 이상이고 20자 이상인 줄만 본문으로 보고, 문장 종결부호로 문장을 세고, 모음군으로 음절을 근사한다. Flesch-Kincaid 는 미국 학년 척도라 한국 학년과 1:1 이 아니다 — **상대 비교**에 쓴다.',
    '',
    '## 학년대별 평균',
    '',
    table(
      [...bandAgg.entries()].sort((a, b) => (a[1].gm ?? 99) - (b[1].gm ?? 99) || (a[1].gx ?? 99) - (b[1].gx ?? 99)).map(([band, g]) => [
        band, String(g.xs.length), avg(g.xs).toFixed(2), avg(g.sl).toFixed(1), avg(g.ttr).toFixed(3),
      ]),
      ['학년대', '문서', 'FK 평균', '평균 문장 길이', 'TTR 평균'], ['', 'r', 'r', 'r', 'r'],
    ),
    '',
    '## 문서별 (학년 눈금 → FK 순)',
    '',
    table(
      measured.map((d) => [
        link(d), d.grade_band, d.series, d.role,
        num(d.analysis.fkGrade, 2), num(d.analysis.fogIndex, 2),
        num(d.analysis.avgSentenceLen, 1), num(d.analysis.ttr, 4),
        int(d.analysis.wordTokens),
      ]),
      ['파일', '학년대', '시리즈', '역할', 'FK', 'Fog', '문장길이', 'TTR', '낱말'],
      ['', '', '', '', 'r', 'r', 'r', 'r', 'r'],
    ),
    '',
  ].join('\n'));

  // ── 06 구멍 ────────────────────────────────────────────────
  const overrides = readJson(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), 'overrides.json'), {});
  const gapDocs = docs.filter((d) => d.extract?.status !== 'ok' || d.low_confidence?.length);
  writeText(path.join(sp.index, '06-gaps.md'), [
    '# 06 · 구멍 목록', '',
    `손대야 할 것만 모았다. **${gapDocs.length}건 / ${docs.length}건**.`,
    '',
    '## 추출이 안 된 문서',
    '',
    table(
      docs.filter((d) => d.extract?.status !== 'ok').map((d) => [
        link(d), d.extract?.status || 'pending', String(d.extract?.pages || 0), fmtBytes(d.size),
        d.extract?.note || d.extract?.error || '',
      ]),
      ['파일', '상태', '쪽', '용량', '사유'], ['', '', 'r', 'r', ''],
    ),
    '',
    'OCR 이 필요한 파일은 이 환경에 OCR 엔진이 없어 대기 상태다. 엔진(tesseract 등)이 준비되면 `extract.mjs` 에 분기를 더하고 `node extract.mjs --force --only <id>` 로 그 문서만 다시 돌린다.',
    '',
    '## 분류가 미확정인 문서',
    '',
    table(
      docs.filter((d) => d.low_confidence?.length).map((d) => [
        link(d), d.low_confidence.join(', '), d.series, d.publisher,
        overrides.unresolved?.[d.series] || '',
      ]),
      ['파일', '미확정 축', '시리즈', '출판사', '확인해 본 결과'], ['', '', '', '', ''],
    ),
    '',
    '고치는 곳: 파일명으로 판단할 수 있으면 `taxonomy.mjs` 의 `SERIES_RULES`, 원문 근거로만 알 수 있으면 `overrides.json`. 둘 다 고친 뒤 `node scan.mjs` 를 다시 돌린다.',
    '',
  ].join('\n'));

  // ── 07 어휘 ────────────────────────────────────────────────
  const vocabLines = ['# 07 · 어휘 비교', '',
    '기능어를 뺀 빈출 낱말 상위 25개를 학년대 순으로 놓는다. 같은 학년대에서 시리즈끼리 어떤 소재를 다루는지 바로 보인다.', ''];
  for (const d of measured) {
    if (!d.analysis.topWords?.length) continue;
    vocabLines.push(`### ${d.grade_band} · ${d.series}${d.volume ? ` ${d.volume}권` : ''} · ${d.role}`);
    vocabLines.push('');
    vocabLines.push(d.analysis.topWords.slice(0, 25).map((w) => `\`${w.w}\`(${w.n})`).join(' '));
    vocabLines.push('');
    vocabLines.push(`— ${link(d)}`);
    vocabLines.push('');
  }
  writeText(path.join(sp.index, '07-vocabulary.md'), vocabLines.join('\n'));

  // ── README ────────────────────────────────────────────────
  writeText(path.join(sp.index, 'README.md'), [
    '# 시중교재 코퍼스 — 색인', '',
    `생성 ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · 문서 **${docs.length}** · 쪽 **${totalPages.toLocaleString()}** · 문자 **${totalChars.toLocaleString()}**`,
    '',
    '| 문서 | 내용 |',
    '|---|---|',
    '| [00-coverage.md](00-coverage.md) | 몇 개를 어디까지 읽어냈나 |',
    '| [01-by-school.md](01-by-school.md) | 학교급 · 학년대별 |',
    '| [02-by-category.md](02-by-category.md) | 독해/어휘/구문/내신/기출 |',
    '| [03-by-series.md](03-by-series.md) | 시리즈별 권 구성 (본책·미리보기·해설 갖춤 여부) |',
    '| [04-by-publisher.md](04-by-publisher.md) | 출판사별 |',
    '| [05-difficulty.md](05-difficulty.md) | **측정된 난이도 비교** (FK · 문장길이 · 어휘 다양도) |',
    '| [06-gaps.md](06-gaps.md) | 아직 못 읽은 것 · 분류 미확정 |',
    '| [07-vocabulary.md](07-vocabulary.md) | 학년대별 빈출 어휘 |',
    '',
    `문서 카드 ${cards}장은 \`../md/<학교급>/\` 아래에 있다. 원문 전량과 교차 질의는 \`../corpus.db\` (SQLite + FTS5).`,
    '',
    '```bash',
    'node scripts/textbook-corpus/query.mjs stats',
    'node scripts/textbook-corpus/query.mjs search "artificial intelligence"',
    'node scripts/textbook-corpus/query.mjs doc <doc_id>',
    '```',
    '',
    '## 다시 만들기',
    '',
    '```bash',
    'node scripts/textbook-corpus/scan.mjs      # 원본 스캔 (새 파일만 잡힌다)',
    'node scripts/textbook-corpus/extract.mjs   # 텍스트 추출',
    'node scripts/textbook-corpus/analyze.mjs   # 지표 계산',
    'node scripts/textbook-corpus/build-db.mjs  # SQLite 적재',
    'node scripts/textbook-corpus/build-md.mjs  # 이 문서들',
    'node scripts/textbook-corpus/verify.mjs    # 목표 대비 자가 검증',
    '```',
    '',
    '> 이 디렉터리의 md 는 **파생물**이다. 손으로 고치면 다음 실행에 지워진다 —',
    '> 분류를 고칠 곳은 `taxonomy.mjs`(파일명으로 알 수 있는 것)와 `overrides.json`(원문 근거가 필요한 것)이다.',
    '',
  ].join('\n'));

  log(`문서 카드 ${cards} · 색인 8 → ${sp.index}`);
  if (FULL) log(`원문 전량 md → ${path.join(sp.root, 'full')}`);
}

main();
