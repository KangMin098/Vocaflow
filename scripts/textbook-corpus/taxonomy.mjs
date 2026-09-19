// scripts/textbook-corpus/taxonomy.mjs
// 시중교재 분류 정본 — 순서 있는 규칙표.
//
// 왜 규칙표인가: 파일명은 출처마다 제각각이고(`빠바 구문독해_미리보기` ·
// `빠른독해 바른독해_구문독해_정답 및 해설` · `2.빠른독해 바른독해_구문독해`)
// 새 미리보기가 계속 추가된다. 분류를 코드 여기저기에 흩으면 새 파일이 들어올 때마다
// 어디를 고쳐야 하는지 알 수 없게 된다. 규칙은 **위에서 아래로** 적용되고
// 각 규칙은 **아직 비어 있는 축만** 채운다 — 구체적인 규칙을 위에 둔다.
//
// 새 교재 추가 절차: SERIES_RULES 에 한 줄 추가(가장 구체적인 위치) →
// `node scan.mjs` → `node verify.mjs`. 미분류가 0 이 아니면 verify 가 실패한다.

/** 학년 눈금 — 초1=1 … 초6=6, 중1=7 … 중3=9, 고1=10 … 고3=12. 비교·정렬용. */
export const GRADE_SCALE = {
  초1: 1, 초2: 2, 초3: 3, 초4: 4, 초5: 5, 초6: 6,
  중1: 7, 중2: 8, 중3: 9,
  고1: 10, 고2: 11, 고3: 12,
};

export function gradeLabel(n) {
  const found = Object.entries(GRADE_SCALE).find(([, v]) => v === n);
  return found ? found[0] : String(n);
}

/** 시리즈 규칙 — 위가 더 구체적이다. 첫 매치가 시리즈를 확정한다. */
export const SERIES_RULES = [
  // ── 평가원 (출제 기관) ─────────────────────────────────────────
  //   출판사가 아니라 **출제 기관**이다. 경쟁자로 세우지 않고 **규격의 원본**으로 쓴다
  //   (`publisher-spec.mjs` 의 `NOT_A_COMPETITOR` 참조). 해설을 내지 않으므로
  //   해설 축으로는 견줄 수도 없다 — 정답표만 낸다.
  //
  //   두 규칙은 자릿수로 갈린다: 모평은 `202409_`(연월 6자리), 수능은 `2024_`(연 4자리).
  { re: /^\d{6}[_ ]?영어영역/, series: '평가원 모의평가', publisher: '평가원', category: '기출', band: [12, 12] },
  { re: /^\d{4}[_ ]?영어/, series: '대학수학능력시험', publisher: '평가원', category: '기출', band: [12, 12] },
  // 사용자가 추출해 둔 텍스트는 `2015.txt` · `2014_A.txt` 처럼 연도(+형)만 있다.
  { re: /^(19|20)\d{2}(_[AB](form)?)?\.txt/i, series: '대학수학능력시험', publisher: '평가원', category: '기출', band: [12, 12] },
  { re: /리딩튜터\s*스타터|스타터\s*리딩튜터/i, series: '리딩튜터 스타터', publisher: 'NE능률', category: '독해', band: [4, 6] },
  { re: /리딩튜터\s*주니어|주니어\s*리딩튜터/i, series: '리딩튜터 주니어', publisher: 'NE능률', category: '독해', band: [6, 9] },
  { re: /리딩튜터\s*챌린저|챌린저\s*리딩튜터/i, series: '리딩튜터 챌린저', publisher: 'NE능률', category: '독해', band: [9, 11] },
  { re: /리딩튜터\s*수능\s*PLUS|수능\s*PLUS/i, series: '리딩튜터 수능PLUS', publisher: 'NE능률', category: '독해', band: [10, 12] },
  { re: /달곰한\s*Literacy|달곰한\s*literacy|달곰한/i, series: '달곰한 Literacy', publisher: 'NE능률', category: '독해', band: [3, 6] },
  { re: /빠바\s*기초세우기|바른독해[_\s]*기초세우기|기초세우기/i, series: '빠른독해 바른독해 - 기초세우기', publisher: 'NE능률', category: '독해', band: [9, 10] },
  { re: /빠바\s*구문독해|바른독해[_\s]*구문독해|빠른독해\s*바른독해\s*구문독해/i, series: '빠른독해 바른독해 - 구문독해', publisher: 'NE능률', category: '구문', band: [10, 11] },
  { re: /빠바\s*유형독해|바른독해[_\s]*유형독해|빠른독해\s*바른독해\s*유형독해/i, series: '빠른독해 바른독해 - 유형독해', publisher: 'NE능률', category: '독해', band: [10, 12] },
  { re: /빠바\s*수능실전|바른독해[_\s]*수능실전/i, series: '빠른독해 바른독해 - 수능실전', publisher: 'NE능률', category: '독해', band: [11, 12] },
  { re: /빠바|빠른독해\s*바른독해/i, series: '빠른독해 바른독해', publisher: 'NE능률', category: '독해', band: [10, 12] },
  { re: /능률\s*VOCA|능률VOCA/i, series: '능률VOCA', publisher: 'NE능률', category: '어휘', band: [10, 12] },
  { re: /1316[\s_]*Reading/i, series: '1316 Reading', publisher: 'NE능률', category: '독해', band: [7, 9] },
  { re: /천일문/i, series: '천일문', publisher: '쎄듀', category: '구문', band: [10, 12] },
  { re: /첫단추/i, series: '첫단추', publisher: '쎄듀', category: '독해', band: [10, 12] },
  { re: /올림포스/i, series: 'EBS 올림포스', publisher: 'EBS', category: '독해', band: [10, 11] },
  // EBS 수능특강은 **수능 연계교재**다 — 고3 대상이고 지문도 수능 길이다.
  //   band [11,12] 로 두면 grade_min 11 → '고2' 버킷에 들어가, 우리 V7(고3) 권을
  //   비교할 상대가 사라진다(어느 출판사도 고3 버킷이 없어 V7 5만 문항이 통째로 빠졌다).
  { re: /수능특강/i, series: 'EBS 수능특강', publisher: 'EBS', category: '독해', band: [12, 12] },
  { re: /수능\s*딥독|중학수능딥독/i, series: '중학 수능 딥독', publisher: '미상', category: '독해', band: [7, 9] },
  { re: /리딩\s*인사이드|Reading\s*Inside/i, series: '리딩인사이드', publisher: '미상', category: '독해', band: [7, 9] },
  { re: /수능\s*1\s*Up/i, series: '수능 1 Up', publisher: '미상', category: '독해', band: [11, 12] },
  { re: /내신백신/i, series: '내신백신', publisher: '미상', category: '내신', band: [11, 12] },
  { re: /다빈출/i, series: '다빈출 학평 독해', publisher: '미상', category: '기출', band: [10, 11] },
  { re: /AST[_\s]*Reading[_\s]*Key/i, series: 'AST Reading Key', publisher: '미상', category: '어휘', band: [3, 6] },
  { re: /ted[_\s]*voca/i, series: 'TED 어휘 참고자료', publisher: '참고자료', category: '어휘', band: null },
  { re: /전국연합학력평가|학력평가\s*기출/i, series: '학력평가 기출문제집', publisher: '미상', category: '기출', band: [10, 11] },
  { re: /Xistory|엑시스토리/i, series: 'Xistory', publisher: '수경출판사', category: '독해', band: [11, 12] },
];

/** 역할 규칙 — 위가 우선. `빠른정답` 은 `정답` 보다 먼저 봐야 한다. */
export const ROLE_RULES = [
  { re: /빠른\s*정답/i, role: '빠른정답' },
  // ⚠️ **평가원 `정답표` 는 해설이 아니라 정답 번호표다.** 아래 정답해설 규칙의
  //   `_정답` 에 걸려 '정답해설' 로 잡히면, 해설이 한 줄도 없는 문서에서 해설 규격
  //   (길이·오답배제·인용)을 뽑게 되어 **합본 A2~A4 기준선이 통째로 내려간다.**
  //   실측 2026-09-01: 규칙을 넣기 전 `202409_영어영역_정답표.pdf` → role=정답해설.
  { re: /정답\s*표/i, role: '빠른정답' },
  { re: /워크북|workbook/i, role: '워크북' },
  { re: /word[_\s]*list|단어장|어휘\s*목록/i, role: '단어장' },
  { re: /해설지|정답\s*및\s*해설|정답및해설|정답\s*재단선|정답\s*\(|정답\(|_정답|해설\s*\(웹용\)|_해설|\s해설/i, role: '정답해설' },
  { re: /미리보기|preview|샘플|sample/i, role: '미리보기' },
  { re: /본문|본책/i, role: '본문' },
];

/** 경로에 든 유형 힌트 — 시리즈 규칙이 유형을 못 정했을 때만 쓴다. */
export const CATEGORY_PATH_RULES = [
  { re: /(^|\/)어휘(\/|$)/, category: '어휘' },
  { re: /(^|\/)내신(\/|$)/, category: '내신' },
  { re: /(^|\/)기출(\/|$)|학평|수능\s*기출/, category: '기출' },
  { re: /(^|\/)문법(\/|$)|grammar/i, category: '문법' },
  { re: /(^|\/)듣기(\/|$)|listening/i, category: '듣기' },
  { re: /(^|\/)독해(\/|$)|reading/i, category: '독해' },
  { re: /구문/, category: '구문' },
];

const GRADE_TOKEN_RE = /(초등|중학|고등|예비중|예비고|초\s?([1-6])|중\s?([1-3])|고\s?([1-3]))/g;

/**
 * 경로에서 학년 구간을 읽는다. `고등1,2` · `중2~중3` · `예비고~고1` · `초등/5~6` 을 모두 다룬다.
 * @returns {{min:number,max:number,label:string}|null}
 */
export function parseGradeBand(pathLike) {
  const text = pathLike.replace(/_/g, '~');
  const hits = [];
  let schoolBase = null;

  for (const m of text.matchAll(GRADE_TOKEN_RE)) {
    const tok = m[0].replace(/\s/g, '');
    if (tok === '초등') { schoolBase = 0; continue; }
    if (tok === '중학') { schoolBase = 6; continue; }
    if (tok === '고등') { schoolBase = 9; continue; }
    if (tok === '예비중') { hits.push(6, 7); continue; }
    if (tok === '예비고') { hits.push(9, 10); continue; }
    if (m[2]) hits.push(Number(m[2]));
    else if (m[3]) hits.push(6 + Number(m[3]));
    else if (m[4]) hits.push(9 + Number(m[4]));
  }

  // `초등/3~4` · `고등1,2` 처럼 학교급 뒤에 맨숫자 구간이 오는 표기.
  if (schoolBase !== null) {
    const bare = text.match(/(초등|중학|고등)\s*\/?\s*([1-6])\s*[~,\-]\s*([1-6])/);
    if (bare) {
      hits.push(schoolBase + Number(bare[2]), schoolBase + Number(bare[3]));
    } else {
      for (const seg of text.split('/')) {
        const r = seg.match(/^\s*([1-6])\s*[~,\-]\s*([1-6])\s*$/);
        if (r) hits.push(schoolBase + Number(r[1]), schoolBase + Number(r[2]));
      }
    }
  }

  if (hits.length === 0) {
    if (schoolBase === 0) return { min: 1, max: 6, label: '초등 전체' };
    if (schoolBase === 6) return { min: 7, max: 9, label: '중등 전체' };
    if (schoolBase === 9) return { min: 10, max: 12, label: '고등 전체' };
    return null;
  }
  const min = Math.min(...hits);
  const max = Math.max(...hits);
  return { min, max, label: min === max ? gradeLabel(min) : `${gradeLabel(min)}~${gradeLabel(max)}` };
}

export function schoolOf(min, max) {
  if (min == null) return '공통';
  const lo = min <= 6 ? '초등' : min <= 9 ? '중등' : '고등';
  const hi = max <= 6 ? '초등' : max <= 9 ? '중등' : '고등';
  return lo === hi ? lo : `${lo}~${hi}`;
}

/** 권 번호 — `L2` · `Level 2` · `2권` · `B1` · `스타터 1` · `Easy1`. */
export function parseVolume(name) {
  const pats = [
    /(?:^|[^A-Za-z])L(?:evel)?\s*([0-9]{1,2})(?![0-9])/i,
    /(?:^|[^A-Za-z])B\s*([0-9]{1,2})(?![0-9])/,
    /([0-9]{1,2})\s*권/,
    /(?:스타터|주니어|챌린저|Easy)\s*([0-9]{1,2})(?![0-9])/i,
    /기본\s*([0-9])(?![0-9])/,
  ];
  for (const re of pats) {
    const m = name.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * 한 파일을 6축으로 분류한다.
 * @param {{relPath:string, fileName:string}} input relPath 는 슬래시 구분 상대경로.
 * @returns {{school,grade_band,grade_min,grade_max,category,role,publisher,series,volume,rules:string[],low_confidence:string[]}}
 */
export function classify({ relPath, fileName }) {
  const hay = `${relPath} ${fileName}`;
  // 같은 시리즈가 `빠바_구문독해` · `빠바 구문독해` 두 표기로 온다. 밑줄을 띄어쓰기로
  // 바꾼 사본도 함께 대조한다 — 역할 규칙은 반대로 `_정답` 처럼 밑줄에 기대므로 둘 다 본다.
  const norm = (s) => s.replace(/_/g, ' ');
  const hit = (re, s) => re.test(s) || re.test(norm(s));
  const rules = [];
  const out = {
    series: null, publisher: null, category: null, role: null,
    grade_min: null, grade_max: null, volume: null,
  };

  const seriesHit = SERIES_RULES.find((r) => hit(r.re, hay));
  if (seriesHit) {
    out.series = seriesHit.series;
    out.publisher = seriesHit.publisher;
    out.category = seriesHit.category;
    rules.push(`series:${seriesHit.series}`);
  }

  const roleHit = ROLE_RULES.find((r) => hit(r.re, fileName));
  if (roleHit) {
    out.role = roleHit.role;
    rules.push(`role:${roleHit.role}`);
  }

  if (!out.category) {
    const catHit = CATEGORY_PATH_RULES.find((r) => hit(r.re, relPath));
    if (catHit) {
      out.category = catHit.category;
      rules.push(`category:${catHit.category}`);
    }
  }

  // 경로가 '초등' 처럼 학교급만 알려줄 때는 시리즈가 아는 구간이 더 정확하다.
  const pathBand = parseGradeBand(relPath);
  const seriesBand = seriesHit?.band ? { min: seriesHit.band[0], max: seriesHit.band[1], label: null } : null;
  const wholeSchool = pathBand && [[1, 6], [7, 9], [10, 12]].some(([a2, b2]) => pathBand.min === a2 && pathBand.max === b2);
  const band = (wholeSchool && seriesBand) ? seriesBand : (pathBand || seriesBand);
  if (band) {
    out.grade_min = band.min;
    out.grade_max = band.max;
    rules.push(`grade:${band.min}-${band.max}`);
  }

  out.volume = parseVolume(fileName);

  // 남은 빈 축을 명시값으로 메운다 — 빈 값은 두지 않되, 무엇이 추정인지 표시한다.
  // low_confidence = 실제로 모르는 축(원본 표지를 봐야 안다).
  // defaults      = 규칙이 없어 기본값을 쓴 축(역할 표기가 없으면 본책이 맞다).
  const low = [];
  const defaults = [];
  if (!out.series) { out.series = '미상'; low.push('series'); }
  if (!out.publisher) { out.publisher = '미상'; low.push('publisher'); }
  if (!out.category) { out.category = '미분류'; low.push('category'); }
  if (!out.role) { out.role = '본책'; defaults.push('role'); }
  // 참고자료(교재가 아닌 것)는 학년이 없는 게 정상이다 — 결함으로 세지 않는다.
  if (out.grade_min == null && out.publisher !== '참고자료') { low.push('grade'); }
  if (out.publisher === '미상' && !low.includes('publisher')) low.push('publisher');

  const school = schoolOf(out.grade_min, out.grade_max);
  const gradeBandLabel = out.grade_min == null
    ? '공통'
    : (out.grade_min === out.grade_max
      ? gradeLabel(out.grade_min)
      : `${gradeLabel(out.grade_min)}~${gradeLabel(out.grade_max)}`);

  return {
    school,
    grade_band: gradeBandLabel,
    grade_min: out.grade_min,
    grade_max: out.grade_max,
    category: out.category,
    role: out.role,
    publisher: out.publisher,
    series: out.series,
    volume: out.volume,
    rules,
    low_confidence: low,
    defaults,
  };
}

/** 6축 중 하나라도 빈 문자열/누락이면 실패 — verify.mjs 가 쓴다. */
export const AXES = ['school', 'grade_band', 'category', 'role', 'publisher', 'series'];

/**
 * overrides.json 을 분류 결과 위에 덮는다. 규칙표는 파일명만 보지만 오버라이드는
 * 원문 판권지처럼 **확인된 근거**를 담는다 — 그래서 규칙보다 세다.
 * byDocPath 가 bySeries 를 이긴다(개별 지정이 더 구체적이다).
 */
export function applyOverrides(axes, { relPath }, overrides) {
  if (!overrides) return axes;
  const out = { ...axes, evidence: null };
  const layers = [
    overrides.bySeries?.[axes.series],
    overrides.byDocPath?.[relPath],
  ].filter(Boolean);

  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (k === 'evidence') { out.evidence = v; continue; }
      if (v == null || v === '') continue;
      out[k] = v;
      out.low_confidence = out.low_confidence.filter((x) => x !== k && !(k === 'grade_band' && x === 'grade'));
      out.rules = [...out.rules, `override:${k}`];
      out.defaults = out.defaults.filter((x) => x !== k);
    }
  }
  if (out.publisher !== '미상') out.low_confidence = out.low_confidence.filter((x) => x !== 'publisher');
  if (out.series !== '미상') out.low_confidence = out.low_confidence.filter((x) => x !== 'series');
  if (out.category !== '미분류') out.low_confidence = out.low_confidence.filter((x) => x !== 'category');
  return out;
}
