// docs/research/csat-learning-eval-20261024/tool/schema.mjs
// 판정 기록(judgment record) 스키마·정규화·검증. 모르는 값/빠진 값은 숫자로 메우지 않고 'UNKNOWN' 으로 명시한다.

export const LEVELS = ['U0', 'U1', 'U2', 'U3', 'U4', 'U5'];
export const LEVEL_NAMES = {
  U0: 'RECALL', U1: 'MEANING', U2: 'EVIDENCE_LINK', U3: 'DISTRACTOR_FAILURE', U4: 'PRINCIPLE_CONDITIONS', U5: 'TRANSFER',
};
export const SPECIAL_LEVELS = ['NOT_EVALUATED', 'UNKNOWN'];
export const EXPOSURE_LEVELS = ['X0', 'X1', 'X2', 'X3', 'X_UNKNOWN'];
export const ELIGIBILITY = ['INDEPENDENT_ELIGIBLE', 'ASSISTED_ONLY', 'UNKNOWN'];
export const PATHS = ['FREE', 'EXPLANATION_FIRST', 'LECTURE_FIRST'];
export const PHASES = ['PRE', 'POST_ASSISTED_CHECK', 'POST_INDEPENDENT', 'TRANSFER'];
export const DATA_ORIGINS = ['SYNTHETIC', 'REAL'];
export const RATER_KINDS = ['human', 'ai'];
export const UNKNOWN = 'UNKNOWN';

// 개인정보로 보이는 키. 어디에 있든 거부한다.
const PII_KEYS = new Set(['email', 'e_mail', 'name', 'full_name', 'first_name', 'last_name', 'real_name', 'student_name', 'learner_name', 'phone', 'phone_number', 'birthdate', 'birth_date', 'address', 'school_name', 'resident_id']);
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /\b01[016789]-?\d{3,4}-?\d{4}\b/;
const PSEUDO_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

/** 순서 수준이면 0..5, 아니면 null(UNKNOWN·NOT_EVALUATED·기타). 특수 수준은 절대 숫자가 되지 않는다. */
export function levelIndex(level) {
  const i = LEVELS.indexOf(level);
  return i < 0 ? null : i;
}
export function isOrdinalLevel(level) { return levelIndex(level) !== null; }
export function exposureIndex(x) {
  const i = ['X0', 'X1', 'X2', 'X3'].indexOf(x);
  return i < 0 ? null : i;
}

function asList(v) { return Array.isArray(v) ? v : []; }
function known(v, allowed) { return allowed.includes(v) ? v : UNKNOWN; }
function str(v) { return typeof v === 'string' && v.trim() !== '' ? v : UNKNOWN; }

/** 평가 근거 항목: 문자열 'EV-U2-a' 또는 {code, ref}. ref 는 'span:S1' | 'failure:F2' | 'option:3' | 'toggle:T1'. */
export function normalizeEvidence(e) {
  if (typeof e === 'string') return { code: e, ref: null };
  if (e && typeof e === 'object' && typeof e.code === 'string') return { code: e.code, ref: typeof e.ref === 'string' ? e.ref : null };
  return { code: UNKNOWN, ref: null };
}

export function normalizeJudgment(j) {
  const o = j && typeof j === 'object' ? j : {};
  const level = LEVELS.includes(o.level) || SPECIAL_LEVELS.includes(o.level) ? o.level : UNKNOWN;
  return {
    rater_id: str(o.rater_id),
    rater_kind: known(o.rater_kind, RATER_KINDS),
    level,
    evidence_codes: asList(o.evidence_codes).map(normalizeEvidence),
    eligibility: o.eligibility === undefined ? null : known(o.eligibility, ELIGIBILITY),
    item_version: o.item_version === undefined ? null : str(o.item_version),
    note: typeof o.note === 'string' ? o.note : '',
  };
}

export function normalizeRecord(r) {
  const o = r && typeof r === 'object' ? r : {};
  const resp = o.response && typeof o.response === 'object' ? o.response : {};
  return {
    record_id: str(o.record_id),
    learner_pseudo_id: str(o.learner_pseudo_id),
    item_id: str(o.item_id),
    item_version: str(o.item_version),
    analysis_version: str(o.analysis_version),
    phase: known(o.phase, PHASES),
    path: known(o.path, PATHS),
    task_format: str(o.task_format),
    attempt_started_at: typeof o.attempt_started_at === 'string' ? o.attempt_started_at : null,
    studied_item_ids: asList(o.studied_item_ids).filter((x) => typeof x === 'string'),
    transfer_eligibility_verified: o.transfer_eligibility_verified === true,
    response: {
      selected_option: resp.selected_option === undefined || resp.selected_option === null ? UNKNOWN : String(resp.selected_option),
      evidence_span_ids: asList(resp.evidence_span_ids).map(String),
      failure_codes: asList(resp.failure_codes).map(String),
      condition_toggles: resp.condition_toggles && typeof resp.condition_toggles === 'object' ? { ...resp.condition_toggles } : {},
    },
    exposure_events: Array.isArray(o.exposure_events) ? o.exposure_events.map((e) => ({ ...e })) : null,
    rater_judgments: asList(o.rater_judgments).map(normalizeJudgment),
    final_level: LEVELS.includes(o.final_level) || SPECIAL_LEVELS.includes(o.final_level) ? o.final_level : null,
    data_origin: known(o.data_origin, DATA_ORIGINS),
  };
}

function scanPii(value, path, errors) {
  if (Array.isArray(value)) { value.forEach((v, i) => scanPii(v, `${path}[${i}]`, errors)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k.toLowerCase())) errors.push(`${path}.${k}: 개인정보로 보이는 필드는 허용하지 않음`);
      scanPii(v, `${path}.${k}`, errors);
    }
    return;
  }
  if (typeof value === 'string' && (EMAIL_RE.test(value) || PHONE_RE.test(value))) errors.push(`${path}: 이메일/전화번호 형태 값`);
}

/** 원본 기록을 검사한다. errors 는 거부 사유, warnings 는 UNKNOWN 으로 처리된 항목. */
export function validateRecord(raw, idx = 0) {
  const errors = [];
  const warnings = [];
  const at = `records[${idx}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: [`${at}: 객체가 아님`], warnings, record: null };
  scanPii(raw, at, errors);
  const pid = raw.learner_pseudo_id;
  if (typeof pid !== 'string' || !PSEUDO_ID_RE.test(pid)) errors.push(`${at}.learner_pseudo_id: 가명 ID 형식([A-Za-z0-9_-], 3~64자, 공백 없음)이 아님`);
  if (typeof raw.record_id !== 'string' || raw.record_id === '') errors.push(`${at}.record_id: 필요`);
  if (raw.data_origin !== undefined && !DATA_ORIGINS.includes(raw.data_origin)) errors.push(`${at}.data_origin: SYNTHETIC|REAL 이어야 함`);
  if (raw.data_origin === undefined) warnings.push(`${at}.data_origin: 없음 → UNKNOWN`);
  for (const [f, allowed] of [['phase', PHASES], ['path', PATHS]]) {
    if (raw[f] === undefined) warnings.push(`${at}.${f}: 없음 → UNKNOWN`);
    else if (!allowed.includes(raw[f])) errors.push(`${at}.${f}: 허용값 ${allowed.join('|')}`);
  }
  for (const f of ['item_id', 'item_version', 'analysis_version', 'task_format']) {
    if (typeof raw[f] !== 'string' || raw[f] === '') warnings.push(`${at}.${f}: 없음 → UNKNOWN`);
  }
  if (!Array.isArray(raw.exposure_events)) warnings.push(`${at}.exposure_events: 없음 → 노출 X_UNKNOWN`);
  if (!Array.isArray(raw.rater_judgments)) warnings.push(`${at}.rater_judgments: 없음`);
  asList(raw.rater_judgments).forEach((j, k) => {
    const jp = `${at}.rater_judgments[${k}]`;
    if (!j || typeof j !== 'object') { errors.push(`${jp}: 객체가 아님`); return; }
    if (j.rater_kind !== undefined && !RATER_KINDS.includes(j.rater_kind)) errors.push(`${jp}.rater_kind: human|ai`);
    if (j.level !== undefined && !LEVELS.includes(j.level) && !SPECIAL_LEVELS.includes(j.level)) errors.push(`${jp}.level: U0~U5|NOT_EVALUATED|UNKNOWN (숫자 금지)`);
    if (j.level === undefined) warnings.push(`${jp}.level: 없음 → UNKNOWN`);
    if (j.eligibility !== undefined && !ELIGIBILITY.includes(j.eligibility)) errors.push(`${jp}.eligibility: 허용값 아님`);
  });
  return { ok: errors.length === 0, errors, warnings, record: errors.length === 0 ? normalizeRecord(raw) : null };
}

/** 데이터셋: 배열 또는 {records:[...]} */
export function extractRecords(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.records)) return input.records;
  return [];
}

export function validateDataset(input) {
  const raws = extractRecords(input);
  const results = raws.map((r, i) => validateRecord(r, i));
  const ids = new Map();
  const dupErrors = [];
  raws.forEach((r, i) => {
    const id = r && r.record_id;
    if (typeof id !== 'string') return;
    if (ids.has(id)) dupErrors.push(`records[${i}].record_id: 중복(${id}, records[${ids.get(id)}])`);
    else ids.set(id, i);
  });
  const errors = results.flatMap((r) => r.errors).concat(dupErrors);
  return {
    ok: errors.length === 0 && raws.length > 0,
    count: raws.length,
    errors: raws.length === 0 ? ['레코드가 없음'] : errors,
    warnings: results.flatMap((r) => r.warnings),
    records: results.filter((r) => r.ok).map((r) => r.record),
  };
}

/** 검증 없이 정규화만(다른 모듈 입력용). */
export function loadRecords(input) { return extractRecords(input).map(normalizeRecord); }
