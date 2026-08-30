// scripts/textbook-corpus/vocab-market-spec.mjs
// 시중 **단어장** 코퍼스 → 기계가 읽는 시장 규격(`vocab-market-spec.json`).
//
// ── 왜 따로 재는가 ──────────────────────────────────────────────────
// `market-spec.mjs` 는 **독해 교재**를 잰다(발문형·지문 어수·선택지 수). 단어장은 그 자로
// 재지지 않는다 — 지문이 없고 발문도 없다. 단어장의 규격은 **표제어 한 칸에 무엇이 들어가는가**
// 와 **몇 개씩 며칠에 나눠 주는가** 다. 그래서 자를 새로 만든다.
//
// ── 표본의 한계를 먼저 적는다 ───────────────────────────────────────
// 코퍼스 79종 중 어휘 교재는 **8종 124쪽**뿐이고, 그중 본문이 실린 것은 능률VOCA 미리보기
// 4종이다(나머지 4종은 낱말 목록 1종 + 빈 HTML 3종). 그래서 이 규격은
// **한 출판사(NE능률) 4권 112쪽 표본**이다 — 업계 전체가 아니다.
//
// 그럼에도 쓸 값이 있는 이유는 능률VOCA 가 국내 고교 단어장 시장의 사실상 표준이고,
// 재는 항목이 **구조**(칸에 무엇이 있나)라서 표본이 얇아도 유무는 갈리기 때문이다.
// 다만 **비율은 하한으로만 읽는다** — PDF 추출이 빠뜨린 것이 있어 실제 보유율은 더 높다.
//
// ── 저작권 경계 ────────────────────────────────────────────────────
// 뽑는 것은 **집계 통계와 구조 신호**뿐이다. 표제어·뜻·예문 원문은 담지 않는다.
// (`market-spec.mjs` 와 같은 규칙 — 그쪽은 발문형만, 여기는 필드 보유율만.)
//
//   node vocab-market-spec.mjs            → packages/library-pipeline/src/vocab/market-spec.json
//   node vocab-market-spec.mjs --print    표준출력으로만
//
// 재실행 안전: 코퍼스를 읽기만 한다. 몇 번 돌려도 같은 값이 나온다.

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { HERE, hasFlag, loadSources, log, storePaths, writeJson } from './lib.mjs';

const OUT = path.resolve(HERE, '../../packages/library-pipeline/src/vocab/market-spec.json');

/**
 * 표제어 블록을 가르는 자리 — 줄머리 네 자리 통번호.
 *
 * 능률VOCA 는 권 전체에 걸쳐 표제어에 일련번호를 매긴다(0001, 0002 …). 그 번호가
 * 줄 맨 앞에 오고 뒤에 공백이 둘 이상 따르는 것이 블록 경계다. 쪽 번호·ISBN 도 네 자리라
 * **줄머리 + 공백 2칸**을 함께 걸어야 오검출이 걸러진다(그냥 `\d{4}` 로 잡으면 ISBN 7114 가 섞인다).
 */
const ENTRY_SPLIT = /^\s*(\d{4})\s\s+/m;

/** 한 블록이 표제어 칸으로 인정되는 최소 길이. 이보다 짧으면 쪽 바닥의 번호 조각이다. */
const MIN_BLOCK_CHARS = 20;

/** 필드 탐지기 — 무엇을 근거로 "그 칸이 있다" 고 보는가. */
const FIELD_PROBES = {
  /** 영문 예문 — 대문자로 시작해 마침표로 끝나는 15자 이상의 영문 덩어리. */
  exampleEn: /[A-Z][a-z]+[^.!?]{15,}[.!?]/,
  /** 예문 한국어 번역 — 한글로 된 서술형 종결. 단어 뜻(명사구)과 갈린다. */
  exampleKo: /[가-힣].{5,}(다|요)\./,
  /** 파생어 — 품사 표시가 있고, 들여쓴 줄에 파생 접미사로 끝나는 낱말이 온다. */
  derived: /\n\s+[a-z]+(ment|tion|sion|ness|ly|ity|ive|al|ous|able|ible|er|ist|y)\b/,
  /** 유의어·반의어 — 기호(⇔ = ↔)나 낱말로 표시된다. */
  synAnt: /[⇔=↔]|반의어|유의어/,
  /** 다의어 — 한 칸 안에 뜻이 번호로 둘 이상. */
  polysemy: /\b2\.\s/,
  /** 품사 표시 — 명/동/형/부 한 글자 라벨. */
  pos: /(^|\s)(명|동|형|부|전|접)\s/,
};

function pct(n, d) {
  return d === 0 ? null : Number((n / d).toFixed(3));
}

/** 어휘 교재 문서를 고른다 — 본문이 실린 것만(빈 HTML·낱말목록 제외). */
function vocabDocs(db) {
  return db.prepare(`
    SELECT id, file_name, publisher, series, school, grade_band, grade_min, grade_max,
           role, pages, chars, unit_kind, unit_count
    FROM docs
    WHERE (category = '어휘' OR role = '단어장')
      AND status IN ('ok','ocr')
      AND chars > 1000
    ORDER BY pages DESC`).all();
}

/** 표제어 칸의 필드 보유율. **하한값이다** — 추출이 빠뜨린 것은 없는 것으로 세어진다. */
function measureEntryFields(db, docs) {
  const perBook = [];
  const totals = { entries: 0 };
  for (const k of Object.keys(FIELD_PROBES)) totals[k] = 0;

  for (const d of docs) {
    const txt = db.prepare('SELECT text FROM pages WHERE doc_id = ? ORDER BY p')
      .all(d.id).map((r) => r.text).join('\n');
    const parts = txt.split(new RegExp(ENTRY_SPLIT.source, 'm'));

    const hit = { entries: 0 };
    for (const k of Object.keys(FIELD_PROBES)) hit[k] = 0;

    // split 결과: [머리, 번호, 본문, 번호, 본문 …]
    for (let i = 1; i < parts.length; i += 2) {
      const body = parts[i + 1] ?? '';
      if (body.length < MIN_BLOCK_CHARS) continue;
      hit.entries += 1;
      for (const [k, re] of Object.entries(FIELD_PROBES)) if (re.test(body)) hit[k] += 1;
    }
    if (hit.entries === 0) continue;

    totals.entries += hit.entries;
    for (const k of Object.keys(FIELD_PROBES)) totals[k] += hit[k];

    perBook.push({
      series: d.series,
      publisher: d.publisher,
      gradeBand: d.grade_band,
      role: d.role,
      pages: d.pages,
      unitKind: d.unit_kind,
      unitCount: d.unit_count,
      entriesMeasured: hit.entries,
      rates: Object.fromEntries(
        Object.keys(FIELD_PROBES).map((k) => [k, pct(hit[k], hit.entries)]),
      ),
    });
  }

  return {
    entriesMeasured: totals.entries,
    booksMeasured: perBook.length,
    rates: Object.fromEntries(
      Object.keys(FIELD_PROBES).map((k) => [k, pct(totals[k], totals.entries)]),
    ),
    perBook,
  };
}

/**
 * 페이싱 — 며칠에 나눠 주는가.
 *
 * 단어장 시장의 구조 신호 중 가장 뚜렷한 것이다. 능률VOCA 는 전 권이 `DAY` 단위이고,
 * 코퍼스의 `unit_kind` 가 그것을 이미 분류해 두었다(교재 분류 6축 중 하나).
 */
function measurePacing(db, docs) {
  const byKind = {};
  const dayCounts = [];
  for (const d of docs) {
    const kind = d.unit_kind || '(없음)';
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (d.unit_kind === 'DAY' && d.unit_count > 0) dayCounts.push(d.unit_count);
  }
  dayCounts.sort((a, b) => a - b);
  return {
    byUnitKind: byKind,
    dayUnitCounts: dayCounts,
    note: '미리보기본이라 권 전체의 DAY 수가 아니라 **미리보기에 실린 DAY 수**다. 하한으로 읽는다.',
  };
}

/**
 * 구성 축 — 권을 무엇으로 나누는가(PART 제목).
 *
 * 능률VOCA 고등 기본의 목차가 `핵심 어휘 / 어원별 / 주제별 / 반의어·혼동어·다의어` 인 것처럼,
 * 단어장은 **묶는 원리를 PART 로 드러낸다.** 우리 `blueprints.ts` 의 `family` 와 같은 자리다.
 */
function measurePartAxes(db, docs) {
  const RE = /PART\s*\n?\s*(?:\d{1,2}\s*)?([가-힣][가-힣\s/·]{1,30})/g;
  const seen = new Map();
  for (const d of docs) {
    const txt = db.prepare('SELECT text FROM pages WHERE doc_id = ? ORDER BY p')
      .all(d.id).map((r) => r.text).join('\n');
    for (const m of txt.matchAll(RE)) {
      const label = m[1].replace(/\s+/g, ' ').trim();
      // `표제어` 는 범례의 말이지 PART 이름이 아니다.
      if (label.length < 2 || label === '표제어') continue;
      seen.set(label, (seen.get(label) ?? 0) + 1);
    }
  }
  // 줄바꿈에서 잘린 꼬리('… 익히는 어')가 온전한 라벨('… 익히는 어휘')과 함께 잡힌다.
  // **더 긴 라벨의 접두사인 것은 버린다** — 같은 PART 를 두 번 세지 않기 위해서다.
  const labels = [...seen.keys()];
  return labels
    .filter((l) => !labels.some((o) => o !== l && o.startsWith(l)))
    .map((label) => ({ label, occurrences: seen.get(label) }))
    .sort((x, y) => y.occurrences - x.occurrences || x.label.localeCompare(y.label));
}

const src = loadSources();
const sp = storePaths(src.store);
const db = new DatabaseSync(sp.db, { readOnly: true });

const docs = vocabDocs(db);
const entryFields = measureEntryFields(db, docs);

const spec = {
  $schema: 'vocab-market-spec/1',
  generatedAt: new Date().toISOString(),
  provenance: {
    corpus: '시중 영어 교재 79종 중 어휘 교재 (저장소 밖 store)',
    documentsConsidered: docs.length,
    documentsMeasured: entryFields.booksMeasured,
    entriesMeasured: entryFields.entriesMeasured,
    publishers: [...new Set(docs.map((d) => d.publisher))],
    limitation:
      '표본이 한 출판사(NE능률) 미리보기본에 쏠려 있다. 구조의 유무는 갈리지만 '
      + '보유율은 **하한**으로만 읽는다 — PDF 추출이 빠뜨린 칸은 없는 것으로 세어진다.',
    rule: '집계 통계와 구조 신호만 담는다. 표제어·뜻·예문 원문은 담지 않는다.',
  },
  entryFields,
  pacing: measurePacing(db, docs),
  partAxes: measurePartAxes(db, docs),
};

if (hasFlag('--print')) {
  console.log(JSON.stringify(spec, null, 2));
} else {
  writeJson(OUT, spec);
  log(`vocab-market-spec → ${OUT}`);
  log(`  문서 ${spec.provenance.documentsMeasured}종 · 표제어 ${spec.provenance.entriesMeasured}칸`);
  for (const [k, v] of Object.entries(entryFields.rates)) log(`  ${k.padEnd(12)} ${v}`);
}
