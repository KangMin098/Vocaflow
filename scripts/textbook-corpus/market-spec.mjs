// scripts/textbook-corpus/market-spec.mjs
// 시중 교재 코퍼스 → **기계가 읽는 시장 규격**(`market-spec.json`).
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// "시중 교재보다 월등하게" 는 숫자가 없으면 루프가 돌지 않는다. 그런데 지금까지
// 이 저장소의 교재 목표값은 대부분 **짐작이었다** — `production-stages.ts` 는
// "수능 지문 90~200어" 라고 적어 두었지만 그건 통념이지 실측이 아니다.
// 여기서는 79개 실제 교재 5,214쪽에서 규격을 **재서** 뽑는다.
//
// ── 저작권 경계 ────────────────────────────────────────────────────
// 뽑는 것은 **집계 통계와 업계 공통 발문형**뿐이다. 지문·해설 원문은 담지 않는다.
// 발문은 **서로 다른 시리즈 2곳 이상에서 같은 형태로 쓰인 것만** 남긴다 —
// 그래야 한 출판사의 창작 표현이 아니라 업계 표준형임이 근거로 남는다.
// (수능·모평 기출에서 굳어진 정형구다.)
//
//   node market-spec.mjs            → packages/library-pipeline/src/textbook/market-spec.json
//   node market-spec.mjs --print    표준출력으로만

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  HERE, hasFlag, loadSources, log, storePaths, writeJson,
} from './lib.mjs';

/** 서로 다른 시리즈 이 수 이상에서 쓰였을 때만 "업계 표준형" 으로 본다. */
const MIN_SERIES_FOR_STANDARD = 2;

const GRADE_LABEL = {
  1: '초1', 2: '초2', 3: '초3', 4: '초4', 5: '초5', 6: '초6',
  7: '중1', 8: '중2', 9: '중3', 10: '고1', 11: '고2', 12: '고3',
};

function quantiles(xs) {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  return {
    n: v.length, min: v[0], p10: q(0.10), p25: q(0.25), median: q(0.5),
    p75: q(0.75), p90: q(0.90), max: v[v.length - 1],
    mean: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)),
  };
}

/** 발문형 — `다음/윗글 …?` 꼴. 시리즈 2곳 이상 공통인 것만 표준으로 친다. */
function extractStems(db) {
  const rows = db.prepare(`
    SELECT d.series, d.publisher, d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status IN ('ok','ocr')`).all();

  // `주어진 글 …`(순서·삽입) 과 `밑줄 친 …`(함의·지시어) 을 빼면 시장 유형 수를 과소 계상한다.
  const RE = /(?:^|\n)\s*(?:\[?\d{1,3}[\].)]?\s*)?((?:다음|위|윗|주어진|밑줄)[^\n?]{4,70}\?)/g;
  const seen = new Map();
  for (const r of rows) {
    for (const m of r.text.matchAll(RE)) {
      const s = m[1].replace(/\s+/g, ' ').trim();
      if (s.length < 8 || s.length > 70) continue;
      if (!seen.has(s)) seen.set(s, { series: new Set(), publishers: new Set(), bands: new Set(), count: 0 });
      const e = seen.get(s);
      e.series.add(r.series);
      e.publishers.add(r.publisher);
      if (r.grade_min != null) e.bands.add(r.grade_min);
      e.count += 1;
    }
  }

  return [...seen.entries()]
    .filter(([, e]) => e.series.size >= MIN_SERIES_FOR_STANDARD)
    .map(([stem, e]) => ({
      stem,
      seriesCount: e.series.size,
      publisherCount: e.publishers.size,
      occurrences: e.count,
      gradeMin: e.bands.size ? Math.min(...e.bands) : null,
      gradeMax: e.bands.size ? Math.max(...e.bands) : null,
      ourType: mapStemToOurType(stem),
    }))
    .sort((a, b) => b.seriesCount - a.seriesCount || b.occurrences - a.occurrences);
}

/**
 * 시중 발문 → 우리 `csat_dcp_items.type`.
 * 대응이 없으면 null — **그게 우리가 아직 못 만드는 유형이라는 뜻이다.**
 */
function mapStemToOurType(stem) {
  const T = [
    [/제목으로/, 'title'],
    [/주장하는 바/, 'claim'],
    [/요지로/, 'main_point'],
    [/주제로/, 'topic'],
    [/한 문장으로 요약/, 'summary'],
    [/빈칸.*들어갈 말/, 'blank'],
    [/목적으로/, 'purpose'],
    [/전체 흐름과 관계 없는/, 'irrelevant'],
    [/어법상 틀린/, 'grammar_fix'],
    [/낱말의 쓰임이 적절하지 않은/, 'vocab_choice'],
    [/심경|분위기/, 'mood'],
    [/내용과 일치하지 않는|내용으로 적절하지 않은/, 'content_match'],
    [/순서로 가장 적절한|이어질 글의 순서|이어질 내용을 순서/, 'order'],
    [/주어진 문장이 들어가기|문장이 들어가기에 가장 적절한/, 'insert'],
    [/밑줄 친.*의미하는|함축적 의미/, 'implication'],
    [/가리키는 대상이 나머지/, 'long_reference'],
  ];
  for (const [re, t] of T) if (re.test(stem)) return t;
  return null;
}

/** 지문 어수 — 영문 우세 줄이 3줄 이상 이어진 덩어리를 한 지문으로 본다. */
function extractPassageSpec(db) {
  const rows = db.prepare(`
    SELECT d.grade_min, d.grade_max, d.series, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status = 'ok' AND d.category IN ('독해','내신','기출')
      AND d.role IN ('본책','본문','미리보기')`).all();

  const byGrade = new Map();
  for (const r of rows) {
    if (r.grade_min == null) continue;
    let buf = [];
    const flush = () => {
      if (buf.length >= 3) {
        const t = buf.join(' ').replace(/\s+/g, ' ');
        const w = (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
        // 40어 미만은 지문이 아니라 예문/보기, 400어 초과는 쪽 경계를 넘어 붙은 것이다.
        if (w >= 40 && w <= 400) {
          if (!byGrade.has(r.grade_min)) byGrade.set(r.grade_min, []);
          byGrade.get(r.grade_min).push(w);
        }
      }
      buf = [];
    };
    for (const line of r.text.split('\n')) {
      const en = (line.match(/[A-Za-z]/g) || []).length;
      const ko = (line.match(/[가-힣]/g) || []).length;
      if (en >= 25 && en > ko * 3) buf.push(line.trim());
      else flush();
    }
    flush();
  }

  const out = {};
  for (const [g, xs] of [...byGrade.entries()].sort((a, b) => a[0] - b[0])) {
    const q = quantiles(xs);
    if (!q || q.n < 10) continue;   // 표본 10 미만은 규격이라 부를 수 없다
    out[GRADE_LABEL[g] || g] = { gradeMin: g, words: q };
  }
  return out;
}

/** 해설 규격 — 길이·오답배제·원문인용. 이게 시장이 고르는 기준이다. */
function extractExplanationSpec(db) {
  const rows = db.prepare(`
    SELECT d.series, d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.role = '정답해설' AND d.status = 'ok'`).all();

  const blocks = [];
  for (const r of rows) {
    for (const m of r.text.matchAll(/해\s?설\s*([\s\S]{40,900}?)(?=\n\s*\n|구\s?문|어\s?휘|정\s?답|$)/g)) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t.length >= 40) blocks.push({ t, series: r.series, g: r.grade_min });
    }
  }
  const lens = blocks.map((b) => b.t.length);
  const hasWrong = blocks.filter((b) => /오답|나머지|적절하지 않|틀린 이유|[①②③④⑤]/.test(b.t)).length;
  const hasCite = blocks.filter((b) => /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/.test(b.t)).length;

  // 해설지를 따로 내는 시리즈의 비율 — 시장 관행이 무엇인지 보여 준다.
  // SQLite 에는 bool_or 가 없다 — max(CASE …) 로 같은 것을 한다.
  const shipping = db.prepare(`
    SELECT count(*) AS total,
           sum(has_ans) AS with_ans
    FROM (SELECT series, max(CASE WHEN role IN ('정답해설','빠른정답') THEN 1 ELSE 0 END) AS has_ans
          FROM docs WHERE category IN ('독해','내신','기출') GROUP BY series)`).get();

  return {
    blocksMeasured: blocks.length,
    lengthChars: quantiles(lens),
    wrongOptionMentionRate: Number((hasWrong / blocks.length).toFixed(3)),
    sourceCitationRate: Number((hasCite / blocks.length).toFixed(3)),
    seriesShippingAnswerKey: shipping,
    note: '해설지를 내는 교재는 사실상 전 문항에 해설이 붙는다 — 보유율의 시장 기준선은 100% 로 본다',
  };
}

/**
 * 학교급별 **유형 밀도** — 어느 학년에 어떤 문항이 실리는가.
 *
 * 이걸 재기 전에는 "중1-2 교재에 수능 순서·삽입을 넣어도 되는가" 를 문서로만 답했다.
 * 재 보니 시중 중등 교재에서 순서·삽입은 쪽당 1% 미만이고 고등에서만 3% 대로 올라온다.
 * 반대로 **본문 어휘 뜻**과 **영작 배열**은 초·중등에서 나오고 고등에서 사라진다.
 * 유형은 난이도가 아니라 **학년의 신분증**이다 — 잘못 실으면 그 권은 그 학년 교재가 아니다.
 */
function extractTypeDensity(db) {
  const PATTERNS = {
    order: /이어질 (글의 )?순서|순서로 가장 적절/,
    insert: /문장이 들어가기|주어진 문장이/,
    unit_vocab: /밑줄 친 .{0,12}의 뜻|뜻으로 알맞은|우리말 뜻/,
    blank_word: /빈칸에 알맞은 (말|낱말|단어)을? 쓰|철자를 쓰/,
    word_order: /배열하(여|시오)|알맞게 배열|순서대로 배열/,
    grammar_fix: /어법상 (틀린|어색한).{0,10}(고쳐|바르게)/,
    topic: /주제로 가장 적절/,
    title: /제목으로 가장 적절/,
    main_point: /요지로 가장 적절/,
    blank: /빈칸에 들어갈 말로 가장 적절/,
    irrelevant: /전체 흐름과 관계 없는/,
    vocab_choice: /낱말의 쓰임이 적절하지 않은/,
    grammar_choice: /어법상 틀린 것은|밑줄 친 부분 중 어법/,
  }
  const rows = db.prepare(`
    SELECT d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status IN ('ok','ocr') AND d.category IN ('독해','내신')`).all();

  const school = (g) => (g == null ? null : g <= 6 ? '초등' : g <= 9 ? '중등' : '고등');
  const agg = {};
  for (const r of rows) {
    const b = school(r.grade_min);
    if (!b) continue;
    agg[b] ??= { pages: 0, hits: {} };
    agg[b].pages += 1;
    for (const [type, re] of Object.entries(PATTERNS)) {
      if (re.test(r.text)) agg[b].hits[type] = (agg[b].hits[type] || 0) + 1;
    }
  }
  const out = {};
  for (const [b, v] of Object.entries(agg)) {
    out[b] = { pagesMeasured: v.pages, densityPerPage: {} };
    for (const type of Object.keys(PATTERNS)) {
      out[b].densityPerPage[type] = Number(((v.hits[type] || 0) / v.pages).toFixed(4));
    }
  }
  return {
    note: '쪽 단위 등장률이다(문항 수가 아니다). 학교급 사이 **상대 비교**로 쓴다 — '
      + '어떤 유형이 그 학년의 교재에 실리는 유형인지 가르는 데 쓴다.',
    bySchool: out,
  };
}

/**
 * **선택지 수** — 학교급별로 몇 지선다인가.
 *
 * ⚠️ 이걸 재기 전에 `middle-choice.ts` 는 "수능 5지선다 · **중등 4지선다**" 라고 적고
 * 4,135문항을 그렇게 만들었다. 근거가 적혀 있지 않은 통념이었고, 재 보니 **반대**다 —
 * 중등 문항의 93.8%가 5지선다이고 초등조차 79.7%다.
 *
 * 세는 법: 쪽 안에서 `①` 이 나오면 한 묶음이 시작된 것으로 보고, **번호가 순증하는
 * 동안만** 같은 묶음으로 잇는다(본문 속 원문자 잡음을 배제한다). 묶음의 최대 번호가
 * 그 문항의 보기 수다. 쪽 단위로 세면 한 쪽에 여러 문항이 있어 값이 흐려진다.
 */
function extractChoiceCount(db) {
  const rows = db.prepare(`
    SELECT d.grade_min, d.series, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status = 'ok' AND d.category IN ('독해','내신')
      AND d.role IN ('본책','본문','미리보기')`).all();

  const LABEL = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };
  const school = (g) => (g == null ? null : g <= 6 ? '초등' : g <= 9 ? '중등' : '고등');
  const agg = {};

  for (const r of rows) {
    const b = school(r.grade_min);
    if (!b) continue;
    agg[b] ??= { counts: {}, series: new Set() };
    agg[b].series.add(r.series);

    let cur = null;
    const flush = () => {
      // 3지 미만은 보기 묶음으로 보지 않는다 — 목차 번호 같은 잡음이다.
      if (cur && cur.max >= 3) agg[b].counts[cur.max] = (agg[b].counts[cur.max] || 0) + 1;
      cur = null;
    };
    for (const m of r.text.matchAll(/[①②③④⑤]/g)) {
      const v = LABEL[m[0]];
      if (v === 1) { flush(); cur = { max: 1, last: 1 }; continue; }
      if (!cur) continue;
      if (v === cur.last + 1) { cur.last = v; cur.max = Math.max(cur.max, v); }
      else flush();
    }
    flush();
  }

  const out = {};
  for (const [b, v] of Object.entries(agg)) {
    const total = Object.values(v.counts).reduce((a, n) => a + n, 0);
    out[b] = {
      seriesMeasured: v.series.size,
      itemsMeasured: total,
      byCount: v.counts,
      dominant: Number(Object.entries(v.counts).sort((a, c) => c[1] - a[1])[0]?.[0] ?? 0),
      fiveChoiceRate: total ? Number(((v.counts[5] || 0) / total).toFixed(3)) : 0,
    };
  }
  return out;
}

/** 단원 구성 — 한 권에 단원이 몇 개, 단원 간격이 몇 쪽인지. */
function extractUnitSpec(db) {
  const rows = db.prepare(`
    SELECT d.id, d.grade_min, d.pages, d.unit_count,
           (SELECT count(*) FROM units u WHERE u.doc_id = d.id) AS units
    FROM docs d
    WHERE d.status = 'ok' AND d.role IN ('본책','본문') AND d.category IN ('독해','내신','기출')
      AND d.unit_count >= 3`).all();
  const counts = rows.map((r) => r.units);
  const perUnitPages = rows.filter((r) => r.units > 0).map((r) => Math.round(r.pages / r.units));
  return {
    booksMeasured: rows.length,
    unitsPerBook: quantiles(counts),
    pagesPerUnit: quantiles(perUnitPages),
  };
}

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const db = new DatabaseSync(sp.db, { readOnly: true });

  const meta = db.prepare(`
    SELECT count(*) docs, sum(pages) pages, sum(chars) chars
    FROM docs WHERE status IN ('ok','ocr')`).get();

  const stems = extractStems(db);
  const spec = {
    $schema: 'market-spec/1',
    generatedAt: new Date().toISOString(),
    provenance: {
      corpus: '시중 영어 교재 79종 (저장소 밖 store)',
      documentsMeasured: meta.docs,
      pagesMeasured: meta.pages,
      charsMeasured: meta.chars,
      rule: '집계 통계와 업계 공통 발문형만 담는다. 지문·해설 원문은 담지 않는다.',
      stemRule: `서로 다른 시리즈 ${MIN_SERIES_FOR_STANDARD}곳 이상에서 같은 형태로 쓰인 발문만 표준형으로 본다`,
    },
    questionStems: stems,
    typeCoverage: {
      standardStems: stems.length,
      mappedToOurTypes: stems.filter((s) => s.ourType).length,
      unmappedStems: stems.filter((s) => !s.ourType).map((s) => s.stem),
      distinctOurTypesCovered: [...new Set(stems.map((s) => s.ourType).filter(Boolean))].sort(),
    },
    passageWords: extractPassageSpec(db),
    explanation: extractExplanationSpec(db),
    typeDensity: extractTypeDensity(db),
    choiceCount: extractChoiceCount(db),
    units: extractUnitSpec(db),
  };

  db.close();

  if (hasFlag('--print')) { console.log(JSON.stringify(spec, null, 2)); return; }

  const out = path.resolve(HERE, '../../packages/library-pipeline/src/textbook/market-spec.json');
  writeJson(out, spec);
  // 원본 대조용 사본은 store 에도 둔다.
  writeJson(path.join(sp.root, 'market-spec.json'), spec);

  log(`시장 규격 → ${out}`);
  log(`  표준 발문 ${spec.questionStems.length}종 (우리 유형 대응 ${spec.typeCoverage.mappedToOurTypes})`);
  log(`  지문 규격 ${Object.keys(spec.passageWords).length} 학년대`);
  log(`  해설 블록 ${spec.explanation.blocksMeasured} — 중앙 ${spec.explanation.lengthChars.median}자 · 오답배제 ${(spec.explanation.wrongOptionMentionRate * 100).toFixed(1)}% · 인용 ${(spec.explanation.sourceCitationRate * 100).toFixed(1)}%`);
  for (const [b, c] of Object.entries(spec.choiceCount)) {
    log(`  선택지 ${b} — 지배값 ${c.dominant}지선다 · 5지 비율 ${(c.fiveChoiceRate * 100).toFixed(1)}% (문항 ${c.itemsMeasured})`);
  }
  log(`  단원 ${spec.units.booksMeasured}권 — 권당 ${spec.units.unitsPerBook?.median}단원 · 단원당 ${spec.units.pagesPerUnit?.median}쪽`);
  if (spec.typeCoverage.unmappedStems.length) {
    log('  ⚠ 우리 유형에 대응 없는 발문:');
    for (const s of spec.typeCoverage.unmappedStems) log(`     - ${s}`);
  }
}

main();
