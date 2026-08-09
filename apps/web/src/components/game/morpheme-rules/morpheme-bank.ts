// apps/web/src/components/game/morpheme-rules/morpheme-bank.ts
// Morpheme Rules 형태소 뱅크 + 회랑 절차 생성기.
//
// 왜 분리했나: 이전 버전은 9문제를 모듈 상수로 하드코딩해 두 번째 판의 정보량이 0이었다.
// 여기서는 접두사 8종 × 어근 28종 격자 위에 실재 단어 61개를 얹어 두고, 매 판 시드로
// 부분 격자(3×3 ~ 4×4)를 잘라낸다. 같은 격자 안에 **실재하지 않는 조합**과
// **실재하지만 이 봉인에 안 맞는 미끼**가 둘 다 남도록 강제하는 것이 생성기의 핵심 계약이다.

export interface Prefix {
  text: string;
  /** 학습자가 '해독'을 써야만 보이는 뜻. 기본 비노출(인출 보호). */
  ko: string;
  /** 오답 직후 가르치는 한 줄 — 왜 그 자리에 못 붙는지. */
  rule: string;
}

export interface Root {
  text: string;
  ko: string;
}

export interface Spell {
  /** 접두사 text */
  p: string;
  /** 어근 text */
  r: string;
  /** 조립된 실재 단어 */
  word: string;
  ko: string;
  /** 봉인 장면 — 뜻을 한국어 사전형으로 주지 않고 '상황'으로만 준다. */
  need: string;
  icon: string;
  done: string;
  /** 봉인이 풀린 뒤 한 줄. */
  effect: string;
}

export const PREFIXES: Prefix[] = [
  { text: 'un', ko: '되돌림·벗겨냄', rule: 'un- 은 이미 된 것을 되돌리거나 벗겨낸다' },
  { text: 're', ko: '다시', rule: 're- 는 한 번 있었던 일을 다시 한다' },
  { text: 'dis', ko: '부정·흩음', rule: 'dis- 는 있던 상태를 부정하거나 흩어 놓는다' },
  { text: 'over', ko: '한도 너머', rule: 'over- 는 정해진 한도를 넘어선다' },
  { text: 'pre', ko: '미리', rule: 'pre- 는 일이 벌어지기 전에 먼저 한다' },
  { text: 'fore', ko: '앞일·앞을', rule: 'fore- 는 앞일을 미리 알거나 앞을 막는다' },
  { text: 'en', ko: '~하게 만들다', rule: 'en- 은 형용사·명사를 "그렇게 만들다"로 바꾼다' },
  { text: 'mis', ko: '어긋나게', rule: 'mis- 는 해야 할 것을 어긋나게 한다' },
];

export const ROOTS: Root[] = [
  { text: 'lock', ko: '잠그다' },
  { text: 'load', ko: '싣다' },
  { text: 'cover', ko: '덮다' },
  { text: 'pack', ko: '싸다' },
  { text: 'wind', ko: '감다' },
  { text: 'fold', ko: '접다' },
  { text: 'do', ko: '하다' },
  { text: 'build', ko: '짓다' },
  { text: 'appear', ko: '나타나다' },
  { text: 'view', ko: '보다·전망' },
  { text: 'cast', ko: '던지다·주조하다' },
  { text: 'tell', ko: '말하다' },
  { text: 'count', ko: '세다' },
  { text: 'place', ko: '놓다' },
  { text: 'charge', ko: '채우다·값을 매기다' },
  { text: 'take', ko: '잡다·가져가다' },
  { text: 'use', ko: '쓰다' },
  { text: 'read', ko: '읽다' },
  { text: 'pay', ko: '치르다' },
  { text: 'write', ko: '글로 쓰다' },
  { text: 'print', ko: '찍어 내다' },
  { text: 'large', ko: '큰' },
  { text: 'rich', ko: '넉넉한' },
  { text: 'close', ko: '닫다' },
  { text: 'code', ko: '부호' },
  { text: 'see', ko: '보다·알다' },
  { text: 'judge', ko: '판단하다' },
  { text: 'lead', ko: '이끌다' },
];

/** 실재 단어 61종. need 는 장면 서술 — 정답 단어의 사전 뜻을 그대로 인쇄하지 않는다. */
export const SPELLS: Spell[] = [
  { p: 'un', r: 'lock', word: 'unlock', ko: '열다', need: '쇠사슬이 감긴 철문이 길을 막는다', icon: '🔒', done: '🔓', effect: '문이 열렸다' },
  { p: 'un', r: 'load', word: 'unload', ko: '짐을 내리다', need: '수레가 짐에 눌려 꼼짝하지 않는다', icon: '🛒', done: '🪶', effect: '수레가 가벼워졌다' },
  { p: 'un', r: 'cover', word: 'uncover', ko: '드러내다', need: '두꺼운 천이 제단을 덮어 정체를 감춘다', icon: '🎪', done: '🏺', effect: '제단이 드러났다' },
  { p: 'un', r: 'pack', word: 'unpack', ko: '풀어 꺼내다', need: '필요한 도구가 봇짐 안에 묶여 있다', icon: '🎒', done: '🧰', effect: '도구를 꺼냈다' },
  { p: 'un', r: 'wind', word: 'unwind', ko: '되감아 풀다', need: '태엽이 끝까지 감겨 굳어버렸다', icon: '🧶', done: '🌀', effect: '태엽이 풀렸다' },
  { p: 'un', r: 'fold', word: 'unfold', ko: '펼치다', need: '접힌 지도가 길을 감추고 있다', icon: '🗺', done: '🧭', effect: '지도가 펼쳐졌다' },
  { p: 'un', r: 'do', word: 'undo', ko: '되돌리다', need: '방금 둔 한 수가 세계를 뒤틀었다', icon: '🪤', done: '🕊', effect: '세계가 제자리로' },

  { p: 're', r: 'build', word: 'rebuild', ko: '재건하다', need: '다리가 무너져 강을 건널 수 없다', icon: '🧱', done: '🌉', effect: '다리가 다시 섰다' },
  { p: 're', r: 'load', word: 'reload', ko: '다시 싣다', need: '화살통이 텅 비었다', icon: '🏹', done: '🎯', effect: '화살을 채웠다' },
  { p: 're', r: 'cover', word: 'recover', ko: '되찾다·회복하다', need: '수호자가 쓰러져 힘을 잃었다', icon: '🩹', done: '💪', effect: '힘을 되찾았다' },
  { p: 're', r: 'appear', word: 'reappear', ko: '다시 나타나다', need: '길잡이 불꽃이 꺼져 사라졌다', icon: '🫧', done: '🕯', effect: '불꽃이 돌아왔다' },
  { p: 're', r: 'view', word: 'review', ko: '다시 살피다', need: '흐릿한 기록에 단서가 숨어 있다', icon: '📜', done: '📖', effect: '단서를 찾았다' },
  { p: 're', r: 'cast', word: 'recast', ko: '다시 주조하다', need: '금 간 검을 녹여 다시 부어야 한다', icon: '🗡', done: '⚔️', effect: '검이 새로 벼려졌다' },
  { p: 're', r: 'tell', word: 'retell', ko: '다시 말하다', need: '잊힌 전설을 다시 들려줘야 문이 열린다', icon: '🗣', done: '📢', effect: '전설이 되살아났다' },
  { p: 're', r: 'count', word: 'recount', ko: '다시 세다', need: '문지기가 셈이 안 맞는다며 막아선다', icon: '🔢', done: '✅', effect: '셈이 맞았다' },
  { p: 're', r: 'place', word: 'replace', ko: '대체하다', need: '톱니 하나가 부서져 자리가 비었다', icon: '🧩', done: '⚙️', effect: '톱니를 갈아 끼웠다' },
  { p: 're', r: 'charge', word: 'recharge', ko: '재충전하다', need: '수정 등의 빛이 꺼져간다', icon: '🔋', done: '⚡', effect: '빛이 되살아났다' },
  { p: 're', r: 'take', word: 'retake', ko: '되찾다', need: '빼앗긴 깃발이 적진에 꽂혀 있다', icon: '🚩', done: '🏳️', effect: '깃발을 되찾았다' },
  { p: 're', r: 'use', word: 'reuse', ko: '재사용하다', need: '남은 재료가 아직 쓸 만하다', icon: '🧪', done: '♻️', effect: '재료를 다시 썼다' },
  { p: 're', r: 'pack', word: 'repack', ko: '다시 싸다', need: '짐이 삐져나와 좁은 문을 지나지 못한다', icon: '🧳', done: '📦', effect: '짐을 다시 쌌다' },
  { p: 're', r: 'wind', word: 'rewind', ko: '되감다', need: '태엽 시계를 거꾸로 돌려야 한다', icon: '⏱', done: '⏪', effect: '시간이 되감겼다' },
  { p: 're', r: 'read', word: 'reread', ko: '다시 읽다', need: '한 번 읽어선 뜻이 잡히지 않는 주문서', icon: '📕', done: '📗', effect: '뜻이 잡혔다' },
  { p: 're', r: 'pay', word: 'repay', ko: '갚다', need: '뱃사공이 묵은 빚부터 갚으라 한다', icon: '💰', done: '🪙', effect: '빚을 갚았다' },
  { p: 're', r: 'do', word: 'redo', ko: '다시 하다', need: '매듭이 엉켜 처음부터 다시 묶어야 한다', icon: '🪢', done: '🎀', effect: '매듭이 정갈해졌다' },
  { p: 're', r: 'write', word: 'rewrite', ko: '고쳐 쓰다', need: '잘못 새겨진 문장이 세계를 어긋나게 한다', icon: '✍️', done: '📝', effect: '문장을 바로잡았다' },
  { p: 're', r: 'print', word: 'reprint', ko: '다시 찍어 내다', need: '한 장뿐인 지도를 일행 수만큼 찍어야 한다', icon: '🖨', done: '🗞', effect: '지도를 더 찍었다' },

  { p: 'dis', r: 'appear', word: 'disappear', ko: '사라지다', need: '두꺼운 벽이 길을 완전히 막는다', icon: '🚧', done: '💨', effect: '벽이 사라졌다' },
  { p: 'dis', r: 'cover', word: 'discover', ko: '발견하다', need: '지도에 없는 샛길이 있다는 소문이 돈다', icon: '🔎', done: '🛤', effect: '샛길을 찾았다' },
  { p: 'dis', r: 'place', word: 'displace', ko: '밀어내다', need: '거대한 바위가 통로 한복판에 놓였다', icon: '🪨', done: '🕳', effect: '바위를 밀어냈다' },
  { p: 'dis', r: 'charge', word: 'discharge', ko: '방출하다', need: '축전지에 갇힌 번개가 웅웅댄다', icon: '🔌', done: '🌩', effect: '번개가 빠져나갔다' },
  { p: 'dis', r: 'count', word: 'discount', ko: '값을 깎다', need: '상인이 통행료를 터무니없이 부른다', icon: '🏷', done: '💵', effect: '값을 깎았다' },
  { p: 'dis', r: 'close', word: 'disclose', ko: '밝히다', need: '증인이 입을 굳게 다물고 있다', icon: '🤐', done: '🗨', effect: '증언을 얻었다' },

  { p: 'over', r: 'load', word: 'overload', ko: '과부하시키다', need: '멈추지 않는 기계를 한계 너머로 몰아야 한다', icon: '🏭', done: '🛑', effect: '기계가 멈췄다' },
  { p: 'over', r: 'take', word: 'overtake', ko: '앞지르다', need: '앞선 전령을 따라잡아야 한다', icon: '🐎', done: '🏁', effect: '전령을 앞질렀다' },
  { p: 'over', r: 'charge', word: 'overcharge', ko: '과충전하다', need: '문을 열려면 수정에 힘을 넘치도록 부어야 한다', icon: '💎', done: '💥', effect: '문이 터져 열렸다' },
  { p: 'over', r: 'use', word: 'overuse', ko: '남용하다', need: '주문을 한도 넘게 써서 마력을 태워버려야 한다', icon: '🪄', done: '🔥', effect: '마력이 타올랐다' },
  { p: 'over', r: 'see', word: 'oversee', ko: '감독하다', need: '일꾼들이 제멋대로라 일이 진척되지 않는다', icon: '👷', done: '👁', effect: '일이 정돈됐다' },
  { p: 'over', r: 'view', word: 'overview', ko: '전체를 굽어보다', need: '숲에 갇혀 전체 지형이 보이지 않는다', icon: '🏞', done: '🔭', effect: '지형이 한눈에' },
  { p: 'over', r: 'pay', word: 'overpay', ko: '웃돈을 치르다', need: '뱃사공이 정가로는 안 간다고 버틴다', icon: '💸', done: '🚤', effect: '배가 움직였다' },
  { p: 'over', r: 'write', word: 'overwrite', ko: '덮어쓰다', need: '옛 기록이 새 진실을 가리고 있다', icon: '📄', done: '🖋', effect: '기록을 덮어썼다' },
  { p: 'over', r: 'cast', word: 'overcast', ko: '흐리게 뒤덮다', need: '눈부신 빛에 눈을 뜰 수 없다', icon: '☀️', done: '☁️', effect: '하늘이 흐려졌다' },

  { p: 'pre', r: 'view', word: 'preview', ko: '미리 보다', need: '안개에 가린 앞 통로가 위험하다', icon: '🌫', done: '🔮', effect: '앞이 보인다' },
  { p: 'pre', r: 'judge', word: 'prejudge', ko: '미리 단정하다', need: '심문이 끝나기 전에 결론을 내야 한다', icon: '⚖️', done: '🔨', effect: '결론이 먼저 났다' },
  { p: 'pre', r: 'load', word: 'preload', ko: '미리 싣다', need: '출발 전에 화물을 채워 둬야 한다', icon: '🚚', done: '🧺', effect: '미리 실었다' },
  { p: 'pre', r: 'pay', word: 'prepay', ko: '선불하다', need: '통행증은 값을 먼저 치러야 나온다', icon: '🎫', done: '🪪', effect: '통행증을 받았다' },

  { p: 'fore', r: 'cast', word: 'forecast', ko: '예보하다', need: '다가올 폭풍을 미리 알려야 한다', icon: '🌪', done: '🌤', effect: '폭풍을 예보했다' },
  { p: 'fore', r: 'tell', word: 'foretell', ko: '예언하다', need: '신탁이 앞일을 말해 달라 한다', icon: '🗿', done: '✨', effect: '앞일을 말했다' },
  { p: 'fore', r: 'see', word: 'foresee', ko: '예견하다', need: '함정이 어디 있을지 미리 알아야 한다', icon: '🧿', done: '🌟', effect: '함정이 보였다' },
  { p: 'fore', r: 'close', word: 'foreclose', ko: '미리 닫아 막다', need: '추격자가 오기 전에 뒷길을 닫아야 한다', icon: '🚪', done: '🔐', effect: '뒷길이 닫혔다' },

  { p: 'en', r: 'large', word: 'enlarge', ko: '확대하다', need: '발판이 너무 작아 발을 디딜 수 없다', icon: '🔩', done: '🟦', effect: '발판이 커졌다' },
  { p: 'en', r: 'rich', word: 'enrich', ko: '풍요롭게 하다', need: '메마른 밭에서 아무것도 자라지 않는다', icon: '🌱', done: '🌾', effect: '밭이 살아났다' },
  { p: 'en', r: 'close', word: 'enclose', ko: '둘러싸다', need: '흩어진 짐승들이 자꾸 달아난다', icon: '🐑', done: '🛖', effect: '울타리가 생겼다' },
  { p: 'en', r: 'code', word: 'encode', ko: '부호로 바꾸다', need: '전갈이 적의 손에 넘어갈 수 있다', icon: '📩', done: '🔏', effect: '전갈을 부호로' },
  { p: 'en', r: 'fold', word: 'enfold', ko: '감싸다', need: '얼어붙은 아이가 떨고 있다', icon: '🥶', done: '🧣', effect: '아이를 감쌌다' },

  { p: 'mis', r: 'take', word: 'mistake', ko: '오인하다', need: '변장한 첩자를 딴 사람으로 착각하게 만들어야 한다', icon: '🎭', done: '🕵️', effect: '첩자를 놓쳤다' },
  { p: 'mis', r: 'place', word: 'misplace', ko: '엉뚱한 곳에 두다', need: '간수의 열쇠를 엉뚱한 곳에 두게 해야 한다', icon: '🗝', done: '🫥', effect: '열쇠가 사라졌다' },
  { p: 'mis', r: 'count', word: 'miscount', ko: '잘못 세다', need: '보초가 인원을 한 치도 틀리지 않고 센다', icon: '🧮', done: '😵‍💫', effect: '셈이 어긋났다' },
  { p: 'mis', r: 'judge', word: 'misjudge', ko: '잘못 판단하다', need: '심판관이 우리 편을 꿰뚫어 본다', icon: '👨‍⚖️', done: '🌀', effect: '판단이 흐려졌다' },
  { p: 'mis', r: 'use', word: 'misuse', ko: '잘못 쓰다', need: '적의 지팡이를 엉뚱하게 쓰게 만들어야 한다', icon: '🦯', done: '💫', effect: '지팡이가 헛돌았다' },
  { p: 'mis', r: 'lead', word: 'mislead', ko: '엉뚱한 길로 이끌다', need: '추격대를 다른 길로 보내야 한다', icon: '🐺', done: '🌲', effect: '추격대가 멀어졌다' },
  { p: 'mis', r: 'read', word: 'misread', ko: '잘못 읽다', need: '문지기가 통행증을 꼼꼼히 읽고 있다', icon: '📚', done: '😵', effect: '문지기가 헷갈렸다' },
];

export const PREFIX_BY_TEXT: Record<string, Prefix> = Object.fromEntries(PREFIXES.map((p) => [p.text, p]));
export const ROOT_BY_TEXT: Record<string, Root> = Object.fromEntries(ROOTS.map((r) => [r.text, r]));
export const SPELL_BY_KEY: Record<string, Spell> = Object.fromEntries(SPELLS.map((s) => [`${s.p}+${s.r}`, s]));

const PREFIX_KEYS = PREFIXES.map((p) => p.text);
const ROOT_KEYS = ROOTS.map((r) => r.text);

const SPELLS_BY_ROOT: Record<string, Spell[]> = (() => {
  const m: Record<string, Spell[]> = {};
  for (const r of ROOT_KEYS) m[r] = [];
  for (const s of SPELLS) m[s.r].push(s);
  return m;
})();

// ─── 시드 RNG ─────────────────────────────────────────────────────────────
// 같은 시드 = 같은 4회랑. '같은 세트 다시'(복수전)와 '새 세트'를 분리할 수 있게.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rshuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 회랑 ─────────────────────────────────────────────────────────────────

export interface Seal {
  id: string;
  spell: Spell;
}

export interface Corridor {
  index: number;
  title: string;
  sub: string;
  prefixes: Prefix[];
  roots: Root[];
  seals: Seal[];
  /** 정답 1건당 되찾는 시간(ms). 회랑이 깊어질수록 준다. */
  rewardMs: number;
  /** 없는 말을 발동했을 때 잃는 시간(ms). */
  penaltyMs: number;
}

interface CorridorCfg {
  nPre: number;
  nRoot: number;
  seals: number;
  /** 격자 안 실재 단어 목표 수 — 봉인 수보다 커야 '미끼'가 생긴다. */
  targetValid: number;
  rewardMs: number;
  penaltyMs: number;
  title: string;
  sub: string;
}

export const CORRIDOR_CFG: CorridorCfg[] = [
  { nPre: 3, nRoot: 3, seals: 3, targetValid: 5, rewardMs: 9000, penaltyMs: 5000, title: '봉인된 회랑', sub: '장면이 원하는 뜻을 형태소로 만들어 발동해라.' },
  { nPre: 3, nRoot: 4, seals: 3, targetValid: 6, rewardMs: 8000, penaltyMs: 6000, title: '흩어진 방', sub: '실재하는 말이 늘었다 — 뜻까지 맞아야 통한다.' },
  { nPre: 4, nRoot: 4, seals: 4, targetValid: 8, rewardMs: 7000, penaltyMs: 6000, title: '시간의 계단', sub: '미끼가 많다. 확신할 때만 확신해라.' },
  { nPre: 4, nRoot: 4, seals: 4, targetValid: 9, rewardMs: 6000, penaltyMs: 7000, title: '마지막 문', sub: '시간은 줄고 미끼는 늘었다.' },
];

export const TOTAL_SEALS = CORRIDOR_CFG.reduce((n, c) => n + c.seals, 0);

interface Pick {
  prefixes: string[];
  roots: string[];
  valid: Spell[];
  cost: number;
}

function countValid(pset: Set<string>, root: string): number {
  return SPELLS_BY_ROOT[root].reduce((n, s) => n + (pset.has(s.p) ? 1 : 0), 0);
}

/**
 * 격자를 고른다. 계약:
 *  (a) 실재 단어 수 ≥ 봉인 수 + 2  → 반드시 미끼가 존재한다.
 *  (b) 실재 단어 수 < 전체 칸 수    → 반드시 '없는 말' 칸이 존재한다.
 * 두 조건을 못 맞추면 단계적으로 완화한다(항상 판이 성립하도록).
 */
function choosePick(rng: () => number, cfg: CorridorCfg, bias: Set<string>, strict: number): Pick | null {
  let best: Pick | null = null;
  const cells = cfg.nPre * cfg.nRoot;
  const minValid = strict >= 2 ? cfg.seals + 2 : strict === 1 ? cfg.seals + 1 : cfg.seals;

  for (let a = 0; a < 40; a++) {
    const prefixes = rshuffle(rng, PREFIX_KEYS).slice(0, cfg.nPre);
    const pset = new Set(prefixes);
    const cand = ROOT_KEYS.map((r) => ({ r, n: countValid(pset, r) })).filter((x) => x.n > 0);
    if (cand.length < cfg.nRoot) continue;

    for (let b = 0; b < 24; b++) {
      const picked = rshuffle(rng, cand).slice(0, cfg.nRoot);
      const total = picked.reduce((n, x) => n + x.n, 0);
      if (total < minValid) continue;
      if (strict >= 2 && total >= cells) continue;
      const roots = picked.map((x) => x.r);
      const rset = new Set(roots);
      const valid = SPELLS.filter((s) => pset.has(s.p) && rset.has(s.r));
      // 봉인은 어근이 겹치지 않게 뽑는다 → 서로 다른 어근이 최소 seals 개 필요.
      const distinctRoots = new Set(valid.map((s) => s.r)).size;
      if (distinctRoots < cfg.seals) continue;
      const biasHit = roots.filter((r) => bias.has(r)).length;
      const cost = Math.abs(total - cfg.targetValid) - biasHit * 0.7;
      if (!best || cost < best.cost) best = { prefixes, roots, valid, cost };
      if (cost <= 0) return best;
    }
  }
  return best;
}

function buildCorridor(rng: () => number, index: number, bias: Set<string>): Corridor {
  const cfg = CORRIDOR_CFG[index];
  const pick = choosePick(rng, cfg, bias, 2) ?? choosePick(rng, cfg, bias, 1) ?? choosePick(rng, cfg, bias, 0);

  // 이론상 도달 불가(어근 28종 중 유효 조합이 늘 충분하다)이지만, 게임이 절대 멈추면
  // 안 되므로 손으로 검증한 안전 격자를 최후 폴백으로 둔다.
  const safePrefixes = cfg.nPre === 3 ? ['re', 'un', 'dis'] : ['re', 'un', 'dis', 'over'];
  const safeRoots = cfg.nRoot === 3 ? ['cover', 'load', 'appear'] : ['cover', 'load', 'charge', 'place'];
  const prefixes = pick ? pick.prefixes : safePrefixes;
  const roots = pick ? pick.roots : safeRoots;
  const pset = new Set(prefixes);
  const rset = new Set(roots);
  const valid = pick ? pick.valid : SPELLS.filter((s) => pset.has(s.p) && rset.has(s.r));

  // 봉인 선택 — 어근 중복 없이, 접두사는 되도록 두 종류 이상.
  const shuffled = rshuffle(rng, valid);
  const seals: Spell[] = [];
  const usedRoots = new Set<string>();
  for (const s of shuffled) {
    if (seals.length >= cfg.seals) break;
    if (usedRoots.has(s.r)) continue;
    seals.push(s);
    usedRoots.add(s.r);
  }
  if (seals.length > 1 && new Set(seals.map((s) => s.p)).size === 1) {
    const alt = shuffled.find((s) => s.p !== seals[0].p && !usedRoots.has(s.r));
    if (alt) {
      usedRoots.delete(seals[seals.length - 1].r);
      seals[seals.length - 1] = alt;
      usedRoots.add(alt.r);
    }
  }
  // 어근 중복 없이 못 채운 경우(격자가 좁을 때)만 중복을 허용해 개수를 맞춘다.
  for (const s of shuffled) {
    if (seals.length >= cfg.seals) break;
    if (seals.includes(s)) continue;
    seals.push(s);
  }

  return {
    index,
    title: cfg.title,
    sub: cfg.sub,
    prefixes: rshuffle(rng, prefixes).map((t) => PREFIX_BY_TEXT[t]),
    roots: rshuffle(rng, roots).map((t) => ROOT_BY_TEXT[t]),
    seals: rshuffle(rng, seals).map((spell, i) => ({ id: `c${index}s${i}`, spell })),
    rewardMs: cfg.rewardMs,
    penaltyMs: cfg.penaltyMs,
  };
}

/** 시드 하나로 4회랑 전부를 만든다. bias 는 학습자 단어장에 등장하는 어근(문맥 연결). */
export function makeSession(seed: number, bias: Set<string>): Corridor[] {
  const rng = mulberry32(seed);
  return CORRIDOR_CFG.map((_, i) => buildCorridor(rng, i, bias));
}

/** 학습자 단어장에서 이 어근을 품은 단어 하나 — 문맥 연결용(없으면 null). */
export function findOwnWord(pool: { en: string; ko: string }[] | undefined, root: string, word: string) {
  if (!pool || pool.length === 0) return null;
  const lower = word.toLowerCase();
  const exact = pool.find((w) => w.en.toLowerCase() === lower);
  if (exact) return exact;
  return pool.find((w) => w.en.toLowerCase().includes(root) && w.en.toLowerCase() !== root) ?? null;
}

export { ROOT_KEYS };
