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
import { pathToFileURL } from 'node:url';
import {
  HERE, hasFlag, loadSources, log, storePaths, writeJson,
} from './lib.mjs';

/**
 * **출판사 한 곳으로 좁히는 SQL 조각.** `null` 이면 전체 합본이다.
 *
 * 왜 인자로 두는가 — 추출 로직의 사본을 만들면 합본 값과 출판사별 값이 조용히 다른 것을
 * 세게 된다(이 파일이 `stemRe` 에서 이미 겪은 함정이다). 같은 함수에 필터만 건넨다.
 */
export const pubClause = (pub) => (pub ? ' AND d.publisher = ?' : '');
export const pubArgs = (pub) => (pub ? [pub] : []);

/** 서로 다른 시리즈 이 수 이상에서 쓰였을 때만 "업계 표준형" 으로 본다. */
export const MIN_SERIES_FOR_STANDARD = 2;

export const GRADE_LABEL = {
  1: '초1', 2: '초2', 3: '초3', 4: '초4', 5: '초5', 6: '초6',
  7: '중1', 8: '중2', 9: '중3', 10: '고1', 11: '고2', 12: '고3',
};

export function quantiles(xs) {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  return {
    n: v.length, min: v[0], p10: q(0.10), p25: q(0.25), median: q(0.5),
    p75: q(0.75), p90: q(0.90), max: v[v.length - 1],
    mean: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)),
  };
}

/**
 * 발문 후보를 찾는 정규식. **한 곳에만 둔다** — `/g` 는 상태를 가지므로 매번 새로 만든다.
 * 권당 유형 폭(`perDocumentTypeSpread`)도 같은 것을 쓴다. 사본을 두면 두 수치가
 * 조용히 다른 것을 세게 된다.
 */
export const stemRe = () =>
  /(?:^|\n)\s*(?:\[?\d{1,3}[\].)]?\s*)?((?:다음|위|윗|주어진|밑줄|글의|글을|빈칸|아래|\(A\)|What)[^\n?]{4,70}\?)/g;

/**
 * **교재 한 권이 담는 표준 유형 수.** 79종을 합친 유형 수(=`distinctOurTypesCovered`)와
 * 다른 값이고, **한 권을 견줄 때는 이쪽이 맞는 분모다.**
 *
 * ⚠️ 없으면 단위가 어긋난다 (실측 2026-08-31): 우리 V5 한 권(10종)을 79종 합본의
 *   16종과 견줘 A5 가 **0.625(❌)** 로 나왔다. 시중 교재도 1권에 16종을 담지 않는다 —
 *   실측 중앙값은 **5종**(고등 8)이다. 같은 10종을 권당 기준으로 재면 2.00(고등 1.25)이다.
 *   (창고↔인쇄물 단위 오류와 같은 계열이다. `market-benchmark.mjs` 머리말 참조.)
 *
 * 발문이 하나도 안 잡힌 교재는 분포에서 뺀다 — 유형이 0 인 교재가 아니라 **OCR 이 못 읽은
 * 교재**다(79종 중 31종만 잡혔다). 0 을 섞으면 중앙값이 실제보다 낮아진다.
 */
export function perDocumentTypeSpread(db, pub = null) {
  const rows = db.prepare(`
    SELECT d.id, d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status IN ('ok','ocr')${pubClause(pub)}`).all(...pubArgs(pub));

  const byDoc = new Map();
  for (const r of rows) {
    if (!byDoc.has(r.id)) byDoc.set(r.id, { types: new Set(), grade: r.grade_min });
    const e = byDoc.get(r.id);
    for (const m of r.text.matchAll(stemRe())) {
      const s = m[1].replace(/\s+/g, ' ').trim();
      if (s.length < 8 || s.length > 70) continue;
      const t = mapStemToOurType(s);
      if (t) e.types.add(t);
    }
  }

  const q = (a, p) => (a.length ? a[Math.floor(p * (a.length - 1))] : null);
  const spread = (docs) => {
    const c = docs.map((d) => d.types.size).filter((n) => n > 0).sort((x, y) => x - y);
    return c.length
      ? { docs: c.length, p10: q(c, 0.1), median: q(c, 0.5), p90: q(c, 0.9), max: c[c.length - 1] }
      : null;
  };

  const all = [...byDoc.values()];
  return {
    note: '교재 **한 권**이 담는 표준 유형 수. 79종을 합친 수와 다르다 — 한 권을 견줄 때 쓴다.',
    documentsTotal: byDoc.size,
    overall: spread(all),
    // 학교급은 `grade_min` 으로 가른다(초 ~6 · 중 7~9 · 고 10~).
    bySchool: {
      초등: spread(all.filter((d) => d.grade != null && d.grade <= 6)),
      중등: spread(all.filter((d) => d.grade != null && d.grade >= 7 && d.grade <= 9)),
      고등: spread(all.filter((d) => d.grade != null && d.grade >= 10)),
    },
  };
}

/** 발문형 — `다음/윗글 …?` 꼴. 시리즈 2곳 이상 공통인 것만 표준으로 친다. */
export function extractStems(db, pub = null) {
  const rows = db.prepare(`
    SELECT d.series, d.publisher, d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status IN ('ok','ocr')${pubClause(pub)}`).all(...pubArgs(pub));

  // 발문의 **첫 낱말**로 후보를 좁힌다 — 넓게 잡으면 선택지·본문 물음표가 다 들어온다.
  //
  // ⚠️ **접두어를 빠뜨리면 그 유형이 시장에 없는 것처럼 보인다** (실측 2026-08-31).
  //   `글의` 가 빠져 있어 **문장 삽입 발문이 통째로 누락됐다**:
  //
  //     글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?   ← **6개 시리즈**
  //
  //   `mapStemToOurType` 에는 `insert` 규칙이 **있었다.** 매핑이 아니라 추출이 못 닿은 것이라
  //   아무 데서도 오류로 드러나지 않았다. 결과: 같은 spec 안에서 두 근거가 어긋났다 —
  //   `typeDensity` 는 고등 쪽에서 insert 를 0.0312(order 0.0304 보다 높다)로 재는데
  //   `questionStems` 에는 없어서, 벤치마크 A5 가 insert 를 **"시장 표준 밖"** 으로 셌다.
  //   `grammar_choice`(우리 권에 13문항)도 같은 이유로 표준 밖이었다 — 그 발문은 `(A)` 로 시작한다.
  //
  //   실측 효과: 표준 발문 **23 → 32종**. 늘어난 9종은 전부 시리즈 2곳 이상 공통이다.
  //   `글을`(내용 불일치) · `아래` · `빈칸` · `(A)`(네모형 어법·어휘) · 영어 발문 3종을 함께 넣었다.
  const RE = stemRe();
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
export function mapStemToOurType(stem) {
  const T = [
    [/제목으로/, 'title'],
    [/주장하는 바/, 'claim'],
    [/요지로/, 'main_point'],
    [/주제로/, 'topic'],
    [/한 문장으로 요약/, 'summary'],
    [/빈칸.*들어갈 말/, 'blank'],
    [/목적으로/, 'purpose'],
    // ⚠️ 띄어쓰기가 판마다 다르다 — `관계 없는` 과 `관계없는` 이 둘 다 쓰인다.
    //   공백을 고정하면 한쪽 판의 발문이 통째로 미대응으로 남는다.
    [/전체 흐름과 관계\s*없는/, 'irrelevant'],
    [/어법상 틀린/, 'grammar_fix'],
    [/낱말의 쓰임이 적절하지 않은/, 'vocab_choice'],
    [/심경|분위기/, 'mood'],
    // 긍정형(`일치하는`)도 같은 유형이다 — 고르는 방향만 뒤집힌 같은 과제다.
    [/내용과 일치하지 않는|내용으로 적절하지 않은|내용과 일치하는/, 'content_match'],
    [/순서로 가장 적절한|이어질 글의 순서|이어질 내용을 순서/, 'order'],
    [/주어진 문장이 들어가기|문장이 들어가기에 가장 적절한/, 'insert'],
    [/밑줄 친.*의미하는|함축적 의미/, 'implication'],
    [/가리키는 대상이 나머지/, 'long_reference'],
    // 네모형(㉠㉡㉢ 대신 (A)(B)(C) 를 쓰는 판) — 어법·어휘 **선택**형이다.
    // 위 `어법상 틀린`(grammar_fix)·`낱말의 쓰임이 적절하지 않은`(vocab_choice)과 다른 발문이라
    // 따로 잡아야 한다. 이 두 줄이 없어 `grammar_choice` 가 시장에 없는 유형으로 잡혔다.
    [/네모 안에서.*어법/, 'grammar_choice'],
    [/네모 안에서.*낱말|네모 안에서.*문맥/, 'vocab_choice'],
    [/답을 알 수 없는/, 'content_match'],
    // 영어 발문 — 중등 교재 일부 시리즈가 쓴다(각 2곳). 우리 유형 대응은 위와 같다.
    [/best title/i, 'title'],
    [/mainly about|main idea/i, 'topic'],
    [/best choice for the blank|for the blank/i, 'blank'],
  ];
  for (const [re, t] of T) if (re.test(stem)) return t;
  return null;
}

/** 지문 어수 — 영문 우세 줄이 3줄 이상 이어진 덩어리를 한 지문으로 본다. */
export function extractPassageSpec(db, pub = null) {
  const rows = db.prepare(`
    SELECT d.grade_min, d.grade_max, d.series, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status = 'ok' AND d.category IN ('독해','내신','기출')
      AND d.role IN ('본책','본문','미리보기')${pubClause(pub)}`).all(...pubArgs(pub));

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
export function extractExplanationSpec(db, pub = null) {
  const rows = db.prepare(`
    SELECT d.series, d.grade_min, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.role = '정답해설' AND d.status = 'ok'${pubClause(pub)}`).all(...pubArgs(pub));

  const blocks = [];
  for (const r of rows) {
    for (const m of r.text.matchAll(/해\s?설\s*([\s\S]{40,900}?)(?=\n\s*\n|구\s?문|어\s?휘|정\s?답|$)/g)) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t.length >= 40) blocks.push({ t, series: r.series, g: r.grade_min });
    }
  }
  // ⚠️ 표본 0 에서 비율을 계산하면 NaN 이거나 0 이 된다. 둘 다 "이 출판사는 해설이 없다" 로
  //    읽히는데, 실제로는 **해설지를 이 코퍼스가 안 갖고 있을 뿐**이다. 출판사별로 쪼개면
  //    이 경우가 실제로 생긴다(EBS·쎄듀는 정답해설 문서가 0건이다).
  //
  // ⚠️ **`role='정답해설'` 을 풀어 본책까지 훑으려는 시도는 이미 기각됐다** (실측 2026-08-31).
  //    EBS 본책 2문서·쎄듀 본문 2문서에 "해설" 이 든 쪽이 573쪽 있어서, 역할 필터가 증거를
  //    가리고 있다고 의심할 만하다 — EBS 가 구속 출판사이고 목표 1.200 이 산술적으로
  //    불가능한 원인이 이 축들이니 더욱 그렇다. 그래서 같은 정규식으로 뽑아 눈으로 봤다:
  //
  //      EBS 본책 542블록  "] - [구조 해설] - [어휘 및 어구] editors to mistakenly
  //                        believe that our journal had conduct-ed[Tthipess]t의udy순.We…"
  //      쎄듀 본문 121블록  "01_챕터01-02.indd 3 2025-05-22 오후 첫3:4단5추:4독8 해유형편_해설…"
  //      NE능률 정답해설 1,945블록  "필자는 타 문화를 이해한다는 것이 단지 겉으로 보이는
  //                        관습, 음식, 언어 등의 표면적인 요소를 아는 데 그쳐서는 안 되며…"
  //
  //    앞의 둘은 **해설이 아니라 목차·판권 쪽의 OCR 잔해**다. 필터를 넓히면 우리는
  //    잡음을 상대로 이겼다고 적게 된다 — 그건 지표를 올린 것이지 교재를 좋게 만든 것이
  //    아니다. 축을 더 재려면 **해설지 자체를 코퍼스에 넣어야** 한다.
  if (blocks.length === 0) {
    return {
      blocksMeasured: 0,
      insufficient: true,
      reason: '이 코퍼스에 해당 출판사의 정답해설 문서가 없다 — 비율을 재지 않는다',
      lengthChars: null,
      wrongOptionMentionRate: null,
      sourceCitationRate: null,
      seriesShippingAnswerKey: null,
    };
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
          FROM docs WHERE category IN ('독해','내신','기출')${pub ? ' AND publisher = ?' : ''}
          GROUP BY series)`).get(...pubArgs(pub));

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
export function extractTypeDensity(db) {
  // ── ⚠️ 발문 대조표를 **두 벌 두지 않는다** (실측 2026-08-31) ────────
  // 이 함수는 원래 `mapStemToOurType` 과 무관한 자기 패턴표를 들고 있었고, 그게 더 좁았다:
  //
  //   밀도표          `제목으로 가장 **적절**`      `전체 흐름과 관계 **띄어쓰기** 없는`
  //   초등 교재 실제   글의 제목으로 가장 **알맞은**   전체 흐름과 관계**없는**
  //
  // **초·중등 교재는 "적절한" 대신 "알맞은" 을 쓴다.** 그래서 초등 밀도가
  // title·topic·blank·main_point 전부 **0** 으로 잡혔다. 실제로는 초등 독해서 6종에서
  // title 45 · blank 43 · topic 28 · irrelevant 15 회가 나온다.
  //
  // 그 0 이 `rung-mix.ts` 로 흘러 **우리 초등 권에서 그 유형들이 통째로 빠졌다** —
  // V2 조립 결과가 `word_order 78 · blank_word 27 · unit_vocab 15` 였고 A5 가 0 종이었다.
  // "시장을 따랐다" 고 적혀 있었지만 따른 것은 **잘못 읽은 시장**이었다.
  //
  // 그래서 발문이 있는 유형은 `stemRe()` + `mapStemToOurType` 한 벌로만 센다.
  // 아래 표에는 **발문이 아예 없는**(지시문으로 나오는) 세 유형만 남긴다.
  const INSTRUCTION_ONLY = {
    unit_vocab: /밑줄 친 .{0,12}의 뜻|뜻으로 알맞은|우리말 뜻/,
    blank_word: /빈칸에 알맞은 (말|낱말|단어)을? 쓰|철자를 쓰/,
    word_order: /배열하(여|시오)|알맞게 배열|순서대로 배열/,
  }
  /** 밀도를 낼 유형 = 발문에서 나오는 것 + 지시문으로만 나오는 것. */
  const DENSITY_TYPES = [
    ...new Set([
      'order', 'insert', 'grammar_fix', 'topic', 'title', 'main_point', 'blank',
      'irrelevant', 'vocab_choice', 'grammar_choice',
      ...Object.keys(INSTRUCTION_ONLY),
    ]),
  ]
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
    // 발문에서 나오는 유형 — 표준 발문 추출과 **같은 정규식·같은 대조표**를 쓴다.
    const onPage = new Set();
    for (const m of r.text.matchAll(stemRe())) {
      const s = m[1].replace(/\s+/g, ' ').trim();
      if (s.length < 8 || s.length > 70) continue;
      const t = mapStemToOurType(s);
      if (t) onPage.add(t);
    }
    // 지시문으로만 나오는 유형.
    for (const [type, re] of Object.entries(INSTRUCTION_ONLY)) {
      if (re.test(r.text)) onPage.add(type);
    }
    for (const t of onPage) agg[b].hits[t] = (agg[b].hits[t] || 0) + 1;
  }
  // ⚠️ **집계는 본 유형을 다 세는데 출력만 목록으로 잘라 내고 있었다.**
  //   위 루프는 `mapStemToOurType` 이 돌려주는 무엇이든 `hits` 에 담는다. 그런데 여기서
  //   하드코딩된 `DENSITY_TYPES` 13종만 내보내서, 시장에 **실재하는데 밀도가 없는** 유형이
  //   생겼다 — claim · content_match · long_reference · mood · purpose · summary 6종.
  //
  //   그 6종은 `typeCoverage` 에는 있다(발문이 실제로 잡혔다). 그래서 같은 규격 안에서
  //   두 근거가 어긋났고, `rung-mix` 가 밀도에서 목표를 유도하므로 **그 6종은 목표 몫이
  //   0 이라 어느 권에도 실릴 수 없었다.** 벤치마크 A5 의 천장이 10/16 = 0.625 로 박힌
  //   원인이 이것이다(실측 2026-08-31).
  //
  //   같은 실수가 이 파일에 이미 한 번 기록돼 있다(위 §발문 추출 — insert·grammar_choice 가
  //   "시장 표준 밖" 으로 세어지던 일). 목록을 손으로 유지하면 반드시 어긋난다.
  //   그래서 **본 것을 다 내보낸다.** 0 인 유형도 남긴다 — "재지 않았다" 와 "재 보니 0" 은
  //   다른 말이고, 그 차이가 여기서 여섯 유형을 죽였다.
  const emitTypes = [...new Set([...DENSITY_TYPES, ...Object.values(agg).flatMap((v) => Object.keys(v.hits))])].sort();
  const out = {};
  for (const [b, v] of Object.entries(agg)) {
    out[b] = { pagesMeasured: v.pages, densityPerPage: {} };
    for (const type of emitTypes) {
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
export function extractChoiceCount(db, pub = null) {
  const rows = db.prepare(`
    SELECT d.grade_min, d.series, p.text
    FROM pages p JOIN docs d ON d.id = p.doc_id
    WHERE d.status = 'ok' AND d.category IN ('독해','내신')
      AND d.role IN ('본책','본문','미리보기')${pubClause(pub)}`).all(...pubArgs(pub));

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
export function extractUnitSpec(db) {
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
      perDocument: perDocumentTypeSpread(db),
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

// 직접 실행할 때만 spec 을 쓴다. `publisher-spec.mjs` 가 추출기를 import 하므로
// 가드가 없으면 import 만으로 market-spec.json 이 덮어써진다.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
