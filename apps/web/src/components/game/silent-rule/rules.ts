// apps/web/src/components/game/silent-rule/rules.ts
// The Silent Rule — 철자 규칙 정의 · 학습자 단어 파생기 · 문(gate) 구성기.
//
// 왜 분리했나 (v07.8 감사):
//   기존 게임은 12패널이 통째로 하드코딩이라 두 번째 판에 "규칙"이 아니라 "어느 칸이었는지"를
//   외워서 풀렸고, 학습자 단어장은 한 글자도 등장하지 못했다(learning_records 0건).
//   여기서는 규칙마다
//     ① 학습자 Word → (옳은 철자 / 어긋난 철자) 쌍을 만드는 derive
//     ② 파생이 안 될 때만 쓰는 내장 뱅크
//   두 개를 두고, 문은 매 판 런타임에 조립한다.
//
// 파생 안전 원칙 — **틀린 문항을 절대 만들지 않는다**:
//   · valid 는 반드시 실재하는 옳은 철자, wrong 은 반드시 실재하지 않는 철자여야 한다.
//   · 굴절이 필요한 규칙(-ing / -ies / -es)은 품사 태그나 DB 굴절형이 뒷받침할 때만 파생한다.
//     (adjective 'happy' → 'happies' 같은 비단어 생성을 원천 차단)
//   · 단자음 -ing 형이 다른 단어의 정답 철자와 충돌하면(plan→planing = plane 의 -ing) 버린다.

import { shuffle, type Word } from '@/components/game/_shared/gamekit';

export interface Pair {
  /** 옳은 철자 */
  valid: string;
  /** 규칙을 어긴 철자 (반드시 비단어) */
  wrong: string;
  /** 학습자 단어에서 나왔으면 그 원본. FSRS 는 오직 이 en 으로만 기록한다. */
  src?: Word;
}

export interface RuleDef {
  id: string;
  /** 규칙 문장 — 제출 이후 리빌에서만 공개된다. */
  statement: string;
  /** 한국어 보조 설명 — 역시 리빌에서만. */
  hint: string;
  derive: (w: Word) => { valid: string; wrong: string } | null;
  bank: BankPair[];
}

type BankPair = readonly [string, string];

// ─── 소도구 ───────────────────────────────────────────────────────────────

const VOWELS = 'aeiou';
const isVowel = (c: string) => VOWELS.includes(c);
const clean = (s: string | undefined) => (s ?? '').trim().toLowerCase();
const isPlain = (s: string) => /^[a-z]+$/.test(s);

type PosKind = 'noun' | 'verb' | 'adjective' | 'adverb';

/** 품사 문자열(‘verb’ · ‘동사’ · ‘v.’ · ‘adj’ …) 정규화. adverb 가 verb 를 포함하므로 순서가 중요. */
function posKind(raw?: string): PosKind | null {
  const s = clean(raw);
  if (!s) return null;
  if (/adverb|부사|(^|[^a-z])adv([^a-z]|$)/.test(s)) return 'adverb';
  if (/adjective|형용사|(^|[^a-z])adj([^a-z]|$)/.test(s)) return 'adjective';
  if (/verb|동사|(^|[^a-z])v[ti]?([^a-z]|$)/.test(s)) return 'verb';
  if (/noun|명사|(^|[^a-z])n([^a-z]|$)/.test(s)) return 'noun';
  return null;
}

function hasInflected(w: Word, form: string): boolean {
  return (w.inflected ?? []).some((f) => clean(f) === form);
}

/** 굴절 파생 자격 — DB 굴절형이 그 형태를 이미 갖고 있거나, 품사가 맞을 때만. */
function allows(w: Word, form: string, kinds: PosKind[]): boolean {
  if (hasInflected(w, form)) return true;
  const k = posKind(w.pos);
  return k !== null && kinds.includes(k);
}

// ─── 내장 뱅크 ────────────────────────────────────────────────────────────

const IE_BANK: BankPair[] = [
  ['believe', 'beleive'], ['achieve', 'acheive'], ['field', 'feild'], ['chief', 'cheif'],
  ['niece', 'neice'], ['friend', 'freind'], ['receive', 'recieve'], ['deceive', 'decieve'],
  ['ceiling', 'cieling'], ['receipt', 'reciept'], ['brief', 'breif'], ['thief', 'theif'],
  ['perceive', 'percieve'], ['shield', 'sheild'], ['priest', 'preist'], ['grief', 'greif'],
  ['yield', 'yeild'], ['relief', 'releif'], ['pierce', 'peirce'], ['review', 'reveiw'],
];

const EDROP_BANK: BankPair[] = [
  ['making', 'makeing'], ['writing', 'writeing'], ['coming', 'comeing'], ['hoping', 'hopeing'],
  ['using', 'useing'], ['riding', 'rideing'], ['taking', 'takeing'], ['smiling', 'smileing'],
  ['caring', 'careing'], ['moving', 'moveing'], ['closing', 'closeing'], ['driving', 'driveing'],
  ['dancing', 'danceing'], ['arriving', 'arriveing'], ['deciding', 'decideing'],
  ['inviting', 'inviteing'], ['living', 'liveing'], ['saving', 'saveing'],
];

const DOUBLE_BANK: BankPair[] = [
  ['running', 'runing'], ['getting', 'geting'], ['swimming', 'swiming'], ['shopping', 'shoping'],
  ['beginning', 'begining'], ['cutting', 'cuting'], ['putting', 'puting'], ['hitting', 'hiting'],
  ['dropping', 'droping'], ['chatting', 'chating'], ['jogging', 'joging'], ['grabbing', 'grabing'],
  ['clapping', 'claping'], ['dragging', 'draging'], ['spinning', 'spining'], ['knitting', 'kniting'],
  ['forgetting', 'forgeting'], ['stepping', 'steping'],
];

const IES_BANK: BankPair[] = [
  ['cities', 'citys'], ['stories', 'storys'], ['babies', 'babys'], ['families', 'familys'],
  ['countries', 'countrys'], ['studies', 'studys'], ['tries', 'trys'], ['copies', 'copys'],
  ['parties', 'partys'], ['armies', 'armys'], ['duties', 'dutys'], ['ladies', 'ladys'],
  ['bodies', 'bodys'], ['skies', 'skys'], ['diaries', 'diarys'], ['enemies', 'enemys'],
];

const SIB_BANK: BankPair[] = [
  ['boxes', 'boxs'], ['dishes', 'dishs'], ['watches', 'watchs'], ['foxes', 'foxs'],
  ['taxes', 'taxs'], ['wishes', 'wishs'], ['churches', 'churchs'], ['brushes', 'brushs'],
  ['buses', 'buss'], ['benches', 'benchs'], ['matches', 'matchs'], ['beaches', 'beachs'],
  ['crashes', 'crashs'], ['mixes', 'mixs'], ['branches', 'branchs'], ['speeches', 'speechs'],
  ['flashes', 'flashs'],
];

const FUL_BANK: BankPair[] = [
  ['careful', 'carefull'], ['helpful', 'helpfull'], ['grateful', 'gratefull'], ['useful', 'usefull'],
  ['beautiful', 'beautifull'], ['wonderful', 'wonderfull'], ['powerful', 'powerfull'],
  ['peaceful', 'peacefull'], ['successful', 'successfull'], ['thankful', 'thankfull'],
  ['meaningful', 'meaningfull'], ['colorful', 'colorfull'], ['painful', 'painfull'],
  ['harmful', 'harmfull'], ['awful', 'awfull'], ['hopeful', 'hopefull'],
];

const LLY_BANK: BankPair[] = [
  ['really', 'realy'], ['finally', 'finaly'], ['usually', 'usualy'], ['carefully', 'carefuly'],
  ['beautifully', 'beautifuly'], ['totally', 'totaly'], ['especially', 'especialy'],
  ['personally', 'personaly'], ['naturally', 'naturaly'], ['actually', 'actualy'],
  ['generally', 'generaly'], ['originally', 'originaly'], ['normally', 'normaly'],
  ['equally', 'equaly'], ['annually', 'annualy'], ['fully', 'fuly'],
];

/**
 * "자음 하나 + ing" 가 우연히 **다른 단어의 옳은 철자**가 되는 충돌 목록.
 * plan → planing 은 plane 의 -ing 형이라 오답 타일로 쓰면 정답을 아는 학습자가 손해를 본다.
 */
const REAL_SINGLE_ING = new Set<string>([
  ...EDROP_BANK.map(([v]) => v),
  'hoping', 'taping', 'pining', 'caning', 'baring', 'mating', 'rating', 'hating', 'coping',
  'moping', 'doting', 'biding', 'filing', 'timing', 'gaping', 'waging', 'staring', 'shining',
  'sloping', 'tiling', 'piling', 'wining', 'siting', 'dining', 'planing', 'stoping', 'ruling',
  'curing', 'luring', 'tuning', 'typing', 'wiping', 'hiring', 'firing', 'miming', 'noting',
  'voting', 'citing', 'biting', 'sniping', 'griping', 'scraping', 'shaping', 'sparing',
  'staging', 'tracing', 'waving', 'wading', 'poking', 'raking', 'robing', 'gazing',
]);

/** -e 탈락 규칙을 적용하면 안 되는 단어(-eing 을 유지하거나 다른 단어와 충돌). */
const EDROP_SKIP = new Set(['singe', 'tinge', 'hinge', 'whinge', 'binge', 'age', 'dye', 'eye', 'ache']);

/** ch 가 /k/ 로 읽혀 -es 가 아니라 -s 를 붙이는 단어. */
const CH_AS_K = new Set(['stomach', 'monarch', 'epoch', 'ache', 'headache', 'mustache', 'anarch']);

// ─── 파생기 ───────────────────────────────────────────────────────────────

function deriveIe(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 4 || b.length > 14) return null;
  const ci = b.indexOf('cei');
  if (ci >= 0) return { valid: b, wrong: `${b.slice(0, ci)}cie${b.slice(ci + 3)}` };
  // 어말 'ie'(movie·pie)는 규칙 대상이 아니므로 제외 — i+1 이 마지막 글자면 건너뛴다.
  for (let i = 1; i + 2 <= b.length - 1; i++) {
    if (b[i] === 'i' && b[i + 1] === 'e' && b[i - 1] !== 'c') {
      return { valid: b, wrong: `${b.slice(0, i)}ei${b.slice(i + 2)}` };
    }
  }
  return null;
}

function deriveEdrop(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 4 || b.length > 12) return null;
  if (EDROP_SKIP.has(b)) return null;
  if (b[b.length - 1] !== 'e') return null;
  const c = b[b.length - 2];
  if (isVowel(c) || c === 'y') return null;
  const valid = `${b.slice(0, -1)}ing`;
  if (!allows(w, valid, ['verb'])) return null;
  return { valid, wrong: `${b}ing` };
}

function deriveDouble(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 3 || b.length > 5) return null;
  const last = b[b.length - 1];
  const prev = b[b.length - 2];
  if (!'bdglmnprt'.includes(last)) return null;
  if (!isVowel(prev)) return null;
  if ([...b].filter(isVowel).length !== 1) return null; // 1음절만 — open→openning 같은 오답 차단
  const head = b.slice(0, -2);
  if (head.length === 0 || [...head].some(isVowel)) return null;
  const wrong = `${b}ing`;
  if (REAL_SINGLE_ING.has(wrong)) return null;
  const valid = `${b}${last}ing`;
  if (!allows(w, valid, ['verb'])) return null;
  return { valid, wrong };
}

function deriveIes(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 4 || b.length > 12) return null;
  if (b[b.length - 1] !== 'y') return null;
  if (isVowel(b[b.length - 2])) return null;
  const valid = `${b.slice(0, -1)}ies`;
  if (!allows(w, valid, ['noun', 'verb'])) return null;
  return { valid, wrong: `${b}s` };
}

function deriveSib(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 3 || b.length > 12) return null;
  if (CH_AS_K.has(b)) return null;
  const sibilant = /(x|ch|sh)$/.test(b) || (/[^s]s$/.test(b) && !/sis$/.test(b));
  if (!sibilant) return null;
  const valid = `${b}es`;
  if (!allows(w, valid, ['noun', 'verb'])) return null;
  return { valid, wrong: `${b}s` };
}

function deriveFul(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 5 || b.length > 14) return null;
  if (!b.endsWith('ful')) return null;
  return { valid: b, wrong: `${b}l` };
}

function deriveLly(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 6 || b.length > 15) return null;
  if (!b.endsWith('lly')) return null;
  if (posKind(w.pos) !== 'adverb') return null; // belly·rally 같은 비부사 차단
  return { valid: b, wrong: `${b.slice(0, -3)}ly` };
}

// ─── 규칙 ─────────────────────────────────────────────────────────────────

export const RULES: RuleDef[] = [
  {
    id: 'ie',
    statement: 'i before e, except after c',
    hint: '기본은 ie · c 뒤에서만 ei 가 된다',
    derive: deriveIe,
    bank: IE_BANK,
  },
  {
    id: 'edrop',
    statement: 'drop the silent e before -ing',
    hint: '자음 + e 로 끝나면 e 를 빼고 -ing 를 붙인다',
    derive: deriveEdrop,
    bank: EDROP_BANK,
  },
  {
    id: 'double',
    statement: 'double the final consonant after a short vowel',
    hint: '1음절 단모음 + 단자음이면 그 자음을 겹치고 -ing',
    derive: deriveDouble,
    bank: DOUBLE_BANK,
  },
  {
    id: 'ies',
    statement: 'consonant + y becomes -ies',
    hint: '자음 뒤의 y 는 i 로 바꾸고 -es 를 붙인다',
    derive: deriveIes,
    bank: IES_BANK,
  },
  {
    id: 'sib',
    statement: 'add -es after s, x, ch, sh',
    hint: '치찰음으로 끝나면 -s 가 아니라 -es',
    derive: deriveSib,
    bank: SIB_BANK,
  },
  {
    id: 'ful',
    statement: 'the suffix -ful keeps a single l',
    hint: 'full 이 아니라 -ful — l 은 하나뿐',
    derive: deriveFul,
    bank: FUL_BANK,
  },
  {
    id: 'lly',
    statement: 'an l-final stem keeps both l before -ly',
    hint: 'real + ly = really — l 이 두 개',
    derive: deriveLly,
    bank: LLY_BANK,
  },
];

// ─── 덱 · 문 조립 ─────────────────────────────────────────────────────────

export interface Deck {
  /** 이번 판의 규칙 순서. 학습자 단어가 붙은 규칙이 앞으로 온다. */
  rules: RuleDef[];
  pairs: Record<string, Pair[]>;
  /** 학습자 단어에서 만들어진 쌍의 총수 — 라벨·통계용. */
  mineCount: number;
}

export function buildDeck(wordPool: Word[] | undefined): Deck {
  const seenSrc = new Set<string>();
  const pool = (wordPool ?? []).filter((w) => {
    const en = clean(w.en);
    if (!isPlain(en) || en.length < 3 || en.length > 16) return false;
    if (seenSrc.has(en)) return false;
    seenSrc.add(en);
    return true;
  });

  const pairs: Record<string, Pair[]> = {};
  let mineCount = 0;

  for (const rule of RULES) {
    const mine: Pair[] = [];
    const seen = new Set<string>();
    for (const w of pool) {
      const d = rule.derive(w);
      if (!d) continue;
      if (d.valid === d.wrong) continue;
      if (seen.has(d.valid)) continue;
      seen.add(d.valid);
      mine.push({ valid: d.valid, wrong: d.wrong, src: w });
    }
    mineCount += mine.length;
    const bank: Pair[] = rule.bank
      .filter(([v]) => !seen.has(v))
      .map(([valid, wrong]) => ({ valid, wrong }));
    pairs[rule.id] = [...mine, ...bank];
  }

  const withMine = RULES.filter((r) => pairs[r.id].some((p) => p.src));
  const without = RULES.filter((r) => !pairs[r.id].some((p) => p.src));
  return { rules: [...shuffle(withMine), ...shuffle(without)], pairs, mineCount };
}

export interface Tile {
  text: string;
  valid: boolean;
  /** 옳은 철자 — 리빌에서만 노출된다. */
  fix: string;
  src?: Word;
  /** 다른 규칙에서 온 디코이면 그 규칙 문장. */
  foreign?: string;
}

export interface Gate {
  index: number;
  rule: RuleDef;
  evidence: { ok: string[]; bad: { text: string; fix: string }[] };
  tiles: Tile[];
  cols: number;
  seal: { prompt: string; answer: string; src?: Word } | null;
  /** 이번 문이 소비한 철자 — 다음 문에서 재탕을 피하는 데 쓴다. */
  keys: string[];
}

/** 문 규격 — 뒤로 갈수록 칸이 늘고, 디코이가 들어오고, 증거가 줄어든다. */
const SHAPES = [
  { ok: 3, bad: 3, decoy: 0, ev: 3 },
  { ok: 3, bad: 3, decoy: 0, ev: 3 },
  { ok: 4, bad: 2, decoy: 1, ev: 2 },
  { ok: 4, bad: 2, decoy: 1, ev: 2 },
  { ok: 4, bad: 3, decoy: 1, ev: 2 },
  { ok: 4, bad: 2, decoy: 2, ev: 2 },
];

export const MAX_GATES = 8;

function take(
  list: Pair[],
  n: number,
  used: ReadonlySet<string>,
  taken: Set<string>,
  prefer: 'mine' | 'bank',
): Pair[] {
  if (n <= 0) return [];
  const free = (p: Pair) => !taken.has(p.valid) && !taken.has(p.wrong);
  const order = (src: Pair[]) => {
    const mine = shuffle(src.filter((p) => !!p.src));
    const bank = shuffle(src.filter((p) => !p.src));
    return prefer === 'mine' ? [...mine, ...bank] : [...bank, ...mine];
  };
  const out = order(list.filter((p) => free(p) && !used.has(p.valid))).slice(0, n);
  if (out.length < n) {
    const chosen = new Set(out.map((p) => p.valid));
    const recycled = order(list.filter((p) => free(p) && !chosen.has(p.valid)));
    out.push(...recycled.slice(0, n - out.length));
  }
  for (const p of out) {
    taken.add(p.valid);
    taken.add(p.wrong);
  }
  return out;
}

export function buildGate(deck: Deck, index: number, used: ReadonlySet<string>): Gate {
  const rule = deck.rules[index % Math.max(1, deck.rules.length)];
  const shape = SHAPES[Math.min(index, SHAPES.length - 1)];
  const list = deck.pairs[rule.id] ?? [];
  const taken = new Set<string>();

  // 증거는 뱅크 우선 — 채점되는 격자에 학습자 단어를 남긴다(FSRS 적재).
  const evOk = take(list, shape.ev, used, taken, 'bank');
  const evBad = take(list, shape.ev, used, taken, 'bank');
  const okPairs = take(list, shape.ok, used, taken, 'mine');
  const badPairs = take(list, shape.bad, used, taken, 'mine');

  const tiles: Tile[] = [
    ...okPairs.map((p) => ({ text: p.valid, valid: true, fix: p.valid, src: p.src })),
    ...badPairs.map((p) => ({ text: p.wrong, valid: false, fix: p.valid, src: p.src })),
  ];

  let decoysLeft = shape.decoy;
  if (decoysLeft > 0) {
    for (const other of shuffle(deck.rules.filter((r) => r.id !== rule.id))) {
      if (decoysLeft <= 0) break;
      const p = take(deck.pairs[other.id] ?? [], 1, used, taken, 'bank')[0];
      if (!p) continue;
      tiles.push({ text: p.wrong, valid: false, fix: p.valid, src: p.src, foreign: other.statement });
      decoysLeft -= 1;
    }
  }

  const sealPair = take(list, 1, used, taken, 'mine')[0];
  const ordered = shuffle(tiles);

  const keys = [
    ...evOk.map((p) => p.valid),
    ...evBad.map((p) => p.valid),
    ...ordered.map((t) => t.fix),
  ];
  if (sealPair) keys.push(sealPair.valid);

  return {
    index,
    rule,
    evidence: {
      ok: evOk.map((p) => p.valid),
      bad: evBad.map((p) => ({ text: p.wrong, fix: p.valid })),
    },
    tiles: ordered,
    cols: ordered.length <= 6 ? 3 : 4,
    seal: sealPair ? { prompt: sealPair.wrong, answer: sealPair.valid, src: sealPair.src } : null,
    keys,
  };
}
