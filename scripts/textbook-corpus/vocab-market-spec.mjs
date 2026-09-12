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
      // 문서 id — `shelfSignals` 가 **같은 문서 집합**(어휘 전문 교재)에서 재기 위해 남긴다.
      id: d.id,
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

/**
 * **독해 교재의 어휘 코너** — 어휘 전문 교재와 합치지 않고 따로 잰다.
 *
 * ── 왜 재는가 ────────────────────────────────────────────────────────
 * 어휘 전문 교재가 코퍼스에 4종(전부 NE능률)뿐이라 "표본이 한 출판사에 쏠렸다" 는 한계가
 * 남는다. 독해 교재에는 단원마다 어휘 코너가 있고 출판사도 여럿이라, 거기서 **어휘 지면이
 * 보통 무엇을 주는지**를 확인할 수 있다.
 *
 * ── 왜 합치지 않는가 ────────────────────────────────────────────────
 * **다른 지면이다.** 독해 교재의 어휘 코너는 표제어와 뜻만 주고 예문·파생어·유의어를 싣지
 * 않는다(지면이 지문에 가 있다). 그것을 어휘 교재의 표제어 칸과 한 모집단으로 세면
 * 시장 기준선이 실제보다 낮아지고, 우리 우위지수가 **공짜로 올라간다.**
 * 그래서 `entryFields` 와 섞지 않고 `readerGlossary` 로 따로 적는다.
 */
function measureReaderGlossary(db) {
  const rows = db.prepare(`
    SELECT d.publisher, d.series, d.category, d.file_name, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status IN ('ok','ocr') AND d.category <> '어휘'`).all();

  // 어휘 코너 쪽의 서명 — 한 쪽에 `영단어 + 한글뜻` 줄이 여럿. 지문 쪽에는 이런 줄이 없다.
  const LINE = /^\s*[a-zA-Z][a-zA-Z'’\-]{2,}\s+[^\n]{0,6}[가-힣]/gm;
  const MIN_LINES_FOR_GLOSSARY_PAGE = 12;

  let pages = 0;
  let lines = 0;
  const publishers = new Set();
  const series = new Set();
  for (const r of rows) {
    const m = r.text.match(LINE);
    if (!m || m.length < MIN_LINES_FOR_GLOSSARY_PAGE) continue;
    pages += 1;
    lines += m.length;
    if (r.publisher) publishers.add(r.publisher);
    if (r.series) series.add(r.series);
  }
  return {
    pagesMeasured: pages,
    headwordLines: lines,
    publishers: [...publishers].sort(),
    seriesCount: series.size,
    note:
      '독해·구문·내신 교재의 어휘 코너. **어휘 전문 교재와 합치지 않는다** — 표제어와 뜻만 주고 '
      + '예문·파생어·유의어를 싣지 않는 다른 지면이라, 한 모집단으로 세면 시장 기준선이 실제보다 '
      + '낮아져 우리 우위지수가 공짜로 올라간다. 어휘 지면의 통상 정보량을 가늠하는 용도로만 쓴다.',
  };
}

/**
 * **매대 신호** — 학습자가 한 권을 *고르기 위해* 쓰는 정보.
 *
 * ── 왜 `entryFields` 와 따로 재는가 ──────────────────────────────────
 * `entryFields` 는 **산 뒤에** 쓰는 것(예문·파생어·유의어)을 잰다. 그런데 이 저장소가
 * 실제로 진 자리는 그 앞이다 — `/library/vocab` 은 내용 우위지수가 1.60 인데도 서가가
 * "그대로" 로 보였다(2026-08-30). **고를 근거를 안 줬기 때문이다.**
 *
 * 시중 단어장은 이 일을 표제어 칸이 아니라 **책의 앞뒤**에서 한다: 판권면 · 목차 ·
 * 학습계획표 · 머리말의 선정 근거 · 시리즈 안내 · 대상 학년. 그래서 같은 자로 재려면
 * 그 신호들을 따로 세어야 한다.
 *
 * ── 왜 어휘 전문 교재 4종만인가 ──────────────────────────────────────
 * `readerGlossary` 와 같은 이유다. 낱말 목록 부록(AST)·참고자료(TED)에는 판권면도 목차도
 * 없어서, 그것을 분모에 넣으면 **시장 기준선이 내려가 우리 지수가 공짜로 올라간다.**
 * 그래서 표제어 칸이 실제로 세어진 문서(= `entryFields.perBook`)만 분모로 쓴다.
 *
 * 보유율은 **하한**이다 — 미리보기본이라 뒤표지·판권면 일부가 빠져 있을 수 있고,
 * 빠진 것은 없는 것으로 세어진다.
 */
const SHELF_PROBES = {
  /** 판권면 — 발행일·판차. "언제 만든 것인가". */
  colophon: /(발행일|펴낸날|초판|개정판|인쇄일)/,
  /** ISBN — 출판물의 신원. */
  isbn: /ISBN|isbn/,
  /** 목차 — 무엇이 어떤 순서로 들어 있는가. */
  toc: /(목차|CONTENTS|Contents)/,
  /** 학습계획표 — 며칠에 끝나는가. */
  studyPlan: /(학습\s*계획|플래너|PLAN|학습법|공부법)/,
  /** 머리말·구성과 특징 — **왜 이 낱말들인가**. 단어장에서 가장 중요한 선택 근거다. */
  preface: /(머리말|서문|이 책의|구성과 특징|왜 이 책)/,
  /** DAY 페이싱 — 하루치가 정해져 있는가. */
  dayPacing: /DAY\s*0?[0-9]/,
  /** 복습·테스트 지면 — 외운 것을 확인할 자리가 있는가. */
  reviewTest: /(TEST|Review|복습|누적)/,
  /** 시리즈 안내 — **다음에 무엇을 볼 것인가**. 서가에서 한 권을 고르게 하는 장치. */
  seriesGuide: /(시리즈|Series|SERIES|단계별|레벨별|어떤 책을)/,
  /** 대상 학년 — 내 수준인가. */
  targetGrade: /(중1|중2|중3|고1|고2|고3|예비고|수능|초등|중등|고등)/,
  /** 부가자료 — 음원·테스트지 등 책 밖에서 더 주는 것. */
  extras: /(무료|부가자료|MP3|어휘테스트지|다운로드)/,
  /** 감수·검토 — 누가 봐 줬는가. */
  proofread: /(감수|검수|자문|원어민 검토)/,
};

/**
 * **지면 장치 — 학습자가 그 단어장을 *펼쳤을 때* 눈에 들어오는 반복 구조물.**
 *
 * ── `shelfSignals` 와 무엇이 다른가 ─────────────────────────────────
 * `shelfSignals` 는 **고르기 전**에 쓰는 것이다(판권면·목차·머리말 — 책 앞뒤).
 * 여기 것은 **고른 뒤 매 쪽마다 반복되는 것**이다(표제어 번호·러닝헤드·품사 약물·
 * 뜻 번호·파생어 줄·예문 짝·어법 박스·DAY 테스트 지면). 시중 단어장의 "디자인" 은
 * 색이나 서체 이전에 **이 장치들이 매 쪽 같은 자리에 있다는 것**이다.
 *
 * ── 왜 따로 재야 하는가 (실측 2026-09-06) ───────────────────────────
 * 우리 카탈로그는 내용 지수 1.635 · 선택 지수 1.288 로 둘 다 이기고 있었다. 그런데
 * 두 자 어느 쪽도 **"펼친 지면"** 을 재지 않는다. 재 보니 `/library/vocab` 에서 한 세트를
 * 열면 낱말과 뜻만 나온다 — 시중 책이 매 쪽에 싣는 열일곱 가지 중 대부분이 없다.
 * 그 격차는 두 지수에 잡히지 않으므로 자를 하나 더 만든다.
 *
 * ── 글꼴이 깨져서 못 세는 것 ────────────────────────────────────────
 * `relationInline`(유의·반의 기호 ⇔ =)은 **지면에 있는데 추출로는 안 잡힌다** — 능률VOCA 는
 * 그 기호를 심볼 폰트로 찍고 PDF 에 글리프가 임베드돼 있지 않다(같은 이유로 발음기호가
 * `[]` 빈 대괄호로 나온다). 4권 중 1권만 잡히는데 지면을 보면 4권 다 갖고 있다.
 * **없는 것으로 세면 시장 기준선이 내려가 우리 지수가 공짜로 오른다.** 그래서
 * `undetectable` 로 빼고 지수의 분모에서도 뺀다.
 */
const APPARATUS_PROBES = {
  /** 표제어 통번호 — 권 전체를 관통하는 일련번호. "몇 번째 낱말인가" 를 늘 보여 준다. */
  entryNumber: /^\s*\d{4}\s{2,}/m,
  /** 러닝헤드 — 쪽마다 지금 어느 DAY 인지. 펼친 자리를 잃지 않게 하는 장치. */
  runningHead: /DAY\s*0?\d{1,2}\s*$/m,
  /** 품사 약물 — 명·동·형·부. 뜻 앞에 늘 같은 자리로 온다. */
  posLabel: /(^|\s)(명|동|형|부|전|접|대)\s/,
  /** 뜻 번호 — 한 칸 안에서 뜻이 갈릴 때 번호가 붙는다. */
  senseNumber: /\s2\.\s/,
  /** 유의·반의 기호 — **지면에 있으나 글리프가 깨져 못 센다**(아래 UNDETECTABLE). */
  relationInline: /\s(=|⇔|↔)\s/,
  /** 파생어 줄 — 표제어 아래 들여쓴 줄에 파생어 + 품사. */
  derivedRow: /\n\s*[a-z]{3,}\s+(명|동|형|부)\s/,
  /** 영문 예문. */
  exampleEn: /[A-Z][a-z]+[^.\n]{15,}\./,
  /** 예문 한국어역 — 예문 바로 아래 같은 자리. */
  exampleKo: /[가-힣]{3,}[^\n]{5,}다\./,
  /** 어법·문해력 박스 — 낱말 하나를 더 깊이 파는 칸. */
  usageNote: /(문해력\s*UP|VOCA vs|TIP|어법|참고)/,
  /** DAY 끝 테스트 지면 — 그날 것을 바로 확인하는 자리. */
  dailyTest: /(DAILY\s*TEST|TEST|테스트)/,
  /** 누적 복습 — 01-05 처럼 앞의 DAY 를 묶어 다시 묻는 지면. */
  cumulativeReview: /(누적|\d{2}\s*[-–~]\s*\d{2})/,
  /** PART 도비라 — 묶음 원리가 바뀌는 자리를 지면으로 알린다. */
  partDivider: /PART\s*0?\d/,
  /** 학습 계획표 — 며칠에 끝나는지 격자로 보여 준다. */
  studyPlanGrid: /(STUDY\s*PLAN|학습\s*계획)/,
  /** 색인 — 낱말로 되찾을 수 있는가. */
  index: /(INDEX|찾아보기|색인)/,
  /** 상호참조 — "그 낱말은 208쪽" 처럼 지면끼리 이어 준다. */
  crossRef: /\(\s*p\.\s*\d+\s*\)/,
  /** 활용형 — (quit–quit) 처럼 불규칙 변화를 표제어 옆에 적는다. */
  inflection: /\([a-z]{3,}[–—-][a-z]{3,}/,
  /** 어근·접사 헤더 — 낱말 묶음의 원리를 지면 머리에 적는다. */
  rootHeader: /(어근|접두사|접미사)/,
  /** 회독 체크칸 — 몇 번 봤는지 손으로 표시하는 자리. */
  checkbox: /(□|☐|✓|체크|회독)/,
};

/**
 * 지면에 있으나 **추출로 셀 수 없는** 장치. 지수의 분모에서 뺀다.
 * 뺀 이유를 규격에 적어 두어야 다음 사람이 "왜 17개인가" 를 되짚을 수 있다.
 */
const APPARATUS_UNDETECTABLE = {
  relationInline:
    '유의·반의 기호(⇔ =)를 심볼 폰트로 찍고 글리프를 임베드하지 않아 추출에서 사라진다. '
    + '지면에는 4권 모두 있다(같은 이유로 발음기호도 빈 대괄호로 나온다). '
    + '없는 것으로 세면 시장 기준선이 내려가 우리 지수가 공짜로 오르므로 뺀다.',
};

function measurePageApparatus(db, docs, measuredIds) {
  const pool = docs.filter((d) => measuredIds.has(d.id));
  const undetectable = Object.keys(APPARATUS_UNDETECTABLE);
  const keys = Object.keys(APPARATUS_PROBES).filter((k) => !undetectable.includes(k));
  const hit = Object.fromEntries(keys.map((k) => [k, 0]));
  const perBook = [];

  for (const d of pool) {
    const txt = db.prepare('SELECT text FROM pages WHERE doc_id = ? ORDER BY p')
      .all(d.id).map((r) => r.text).join('\n');
    const found = keys.filter((k) => APPARATUS_PROBES[k].test(txt));
    for (const k of found) hit[k] += 1;
    perBook.push({ id: d.id, series: d.series, gradeBand: d.grade_band, apparatus: found });
  }

  return {
    booksMeasured: pool.length,
    signalCount: keys.length,
    rates: Object.fromEntries(keys.map((k) => [k, pct(hit[k], pool.length)])),
    /** 한 권이 지면에 싣는 장치의 평균 개수. **디자인 지수의 분모**다. */
    meanApparatusPerBook: pool.length === 0
      ? null
      : Number((perBook.reduce((n, b) => n + b.apparatus.length, 0) / pool.length).toFixed(3)),
    perBook,
    undetectable: APPARATUS_UNDETECTABLE,
    note:
      '학습자가 한 권을 **펼쳤을 때** 매 쪽 같은 자리에서 만나는 반복 구조물. '
      + '`shelfSignals`(고르기 전 정보)와 분리해서 센다. 미리보기본이라 **하한**이다 — '
      + '없다고 나온 장치가 본책에는 있을 수 있다.',
  };
}

function measureShelfSignals(db, docs, measuredIds) {
  const pool = docs.filter((d) => measuredIds.has(d.id));
  const keys = Object.keys(SHELF_PROBES);
  const hit = Object.fromEntries(keys.map((k) => [k, 0]));
  const perBook = [];

  for (const d of pool) {
    const txt = db.prepare('SELECT text FROM pages WHERE doc_id = ? ORDER BY p')
      .all(d.id).map((r) => r.text).join('\n');
    const found = keys.filter((k) => SHELF_PROBES[k].test(txt));
    for (const k of found) hit[k] += 1;
    perBook.push({ id: d.id, series: d.series, gradeBand: d.grade_band, signals: found });
  }

  return {
    booksMeasured: pool.length,
    /** 신호별 보유율 — 분모는 어휘 전문 교재 수. */
    rates: Object.fromEntries(keys.map((k) => [k, pct(hit[k], pool.length)])),
    /**
     * 한 권이 평균 몇 개의 선택 근거를 주는가. **선택 지수의 분모**다
     * (`scripts/vocab/choice-benchmark.mjs`).
     */
    meanSignalsPerBook: pool.length === 0
      ? null
      : Number((perBook.reduce((n, b) => n + b.signals.length, 0) / pool.length).toFixed(3)),
    signalCount: keys.length,
    perBook,
    note:
      '학습자가 한 권을 **고르기 위해** 쓰는 정보. 표제어 칸이 아니라 책 앞뒤(판권면·목차·'
      + '머리말·시리즈 안내)에 있다. 분모는 어휘 전문 교재만 — 낱말 목록 부록·참고자료를 넣으면 '
      + '기준선이 내려가 우리 지수가 공짜로 올라간다. 미리보기본이라 **하한**이다.',
  };
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
    /**
     * 표본을 넓히려고 **실제로 해 본 것과 왜 못 넓혔는지**. 다음 사람이 같은 길을 다시 파지
     * 않게 남긴다 — "표본이 얇다" 만 적어 두면 넓힐 수 있는데 안 한 것처럼 읽힌다.
     */
    wideningAttempts: [
      '어휘 전문 교재를 더 찾음 — 코퍼스에 4종이 전부다(나머지는 빈 HTML 3 + 낱말 목록 1).',
      '추출을 느슨하게 해 표제어를 더 뽑아 봄 — 엄격/느슨이 61/61 · 34/34 로 거의 같다. '
        + '미리보기본이라 140칸이 실제 상한이고 누락이 아니다.',
      'AST 낱말 목록(role=단어장, 9쪽)으로 두 번째 출판사를 만들려 함 — PDF 컬럼이 깨져 '
        + '표제어와 뜻의 짝을 맞출 수 없고, 예문이 아예 없는 교재 부록이라 제품 유형이 다르다.',
      '독해 교재의 어휘 코너를 합치려 함 — 출판사는 여럿이지만 **다른 지면**이라 합치지 않고 '
        + 'readerGlossary 로 따로 적었다.',
    ],
  },
  entryFields,
  shelfSignals: measureShelfSignals(
    db,
    docs,
    new Set(entryFields.perBook.map((b) => b.id)),
  ),
  pageApparatus: measurePageApparatus(
    db,
    docs,
    new Set(entryFields.perBook.map((b) => b.id)),
  ),
  pacing: measurePacing(db, docs),
  readerGlossary: measureReaderGlossary(db),
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
