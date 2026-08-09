// apps/web/src/components/game/silent-rule/rules.ts
// The Silent Rule — 철자 규칙 정의 · 학습자 단어 파생기 · 문(gate) 구성기.
//
// 왜 분리했나 (v07.8 감사):
//   기존 게임은 12패널이 통째로 하드코딩이라 두 번째 판에 "규칙"이 아니라 "어느 칸이었는지"를
//   외워서 풀렸고, 학습자 단어장은 한 글자도 등장하지 못했다(learning_records 0건).
//   여기서는 규칙마다
//     ① 학습자 Word → (옳은 철자 / 어긋난 철자) 쌍을 만드는 derive
//     ② 파생이 안 될 때만 쓰는 내장 뱅크
//     ③ 그 규칙의 **예외어**(규칙을 겉으로만 따르면 반드시 틀리는 실재 단어)
//   세 개를 두고, 문은 매 판 런타임에 조립한다.
//
// 파생 안전 원칙 — **틀린 문항을 절대 만들지 않는다**:
//   · valid 는 반드시 실재하는 옳은 철자, wrong 은 반드시 실재하지 않는 철자여야 한다.
//   · 굴절이 필요한 규칙(-ing / -ies / -es)은 품사 태그나 DB 굴절형이 뒷받침할 때만 파생한다.
//     (adjective 'happy' → 'happies' 같은 비단어 생성을 원천 차단)
//   · 단자음 -ing 형이 다른 단어의 정답 철자와 충돌하면(plan→planing = plane 의 -ing) 버린다.
//
// v07.10 적대적 반증에서 뚫린 세 곳을 여기서 막았다:
//   ① [치명] 접미사 대조 지배 전략 — 한 문의 타일이 전부 같은 결정적 변환에서 나와
//      "끝 2~4글자가 증거 '옳다' 쪽과 같은 칸만 밝힌다"로 영어 지식 0에 완봉이 났다.
//      → 디코이를 '다른 규칙의 어긋난 철자'에서 **이 규칙의 예외어**로 바꿨다. 예외어는
//        설계상 접미사 서명이 뒤집혀 있어(옳은데 S− 로 끝나거나, 어긋났는데 S+ 로 끝난다)
//        접미사 대조가 문당 반드시 1~2칸을 틀린다. rules 를 알아야만 완봉이 된다.
//   ② [보통] deriveSib 가 species→'specieses', goods→'goodses' 같은 비단어를 '옳은 철자'로
//      출제했다. → 이미 -s/-es 로 끝나는 명사를 전수 차단.
//   ③ [낮음] REAL_SINGLE_ING 손 나열의 구멍(strip·spit·scar·slat). → "e 를 붙이면 동사가
//      되는 어간" 목록에서 기계 생성으로 교체.

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
  /**
   * 이 규칙의 **예외어** — valid 는 "규칙을 겉으로 적용하면 틀렸다고 판정하게 되는 실재 단어",
   * wrong 은 "규칙을 겉으로 적용하면 옳다고 판정하게 되는 비단어".
   * show 는 그중 **어느 극성이 접미사 대조를 실제로 깨는가**(시뮬로 확인한 값):
   *   both  — 양쪽 다 깬다(무작위로 낸다)
   *   valid — 옳은 쪽만 깬다(예: 'seeing' 은 깨지만 'seing' 은 여전히 -eing 으로 끝나 안 깬다)
   *   wrong — 어긋난 쪽만 깬다(예: 'dutyful' 은 -ful 로 끝나 밝혀지지만 어긋난 철자다)
   */
  exceptions: ExceptionSpec[];
  /** 예외 칸이 나왔을 때 리빌에서 한 줄로 설명할 문장. */
  exceptionNote: string;
}

type BankPair = readonly [string, string];

/** 예외어 한 항목 — [옳은 철자, 어긋난 철자, 접미사 대조를 깨는 극성]. */
type ExceptionSpec = readonly [string, string, 'both' | 'valid' | 'wrong'];

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

/** ie 예외 — 'ei' 인데 옳은 단어 / 'cie' 인데 옳은 단어 (그리고 그 역방향 비단어). */
const IE_EXCEPTIONS: ExceptionSpec[] = [
  ['weird', 'wierd', 'both'], ['seize', 'sieze', 'both'], ['their', 'thier', 'both'],
  ['height', 'hieght', 'both'], ['foreign', 'foriegn', 'both'], ['neither', 'niether', 'both'],
  ['leisure', 'liesure', 'both'], ['protein', 'protien', 'both'], ['veil', 'viel', 'both'],
  ['vein', 'vien', 'both'], ['caffeine', 'caffiene', 'both'], ['forfeit', 'forfiet', 'both'],
  ['science', 'sceince', 'both'], ['ancient', 'anceint', 'both'], ['efficient', 'efficeint', 'both'],
  ['conscience', 'consceince', 'both'], ['society', 'soceity', 'both'], ['glacier', 'glaceir', 'both'],
  ['sufficient', 'sufficeint', 'both'], ['financier', 'financeir', 'both'],
];

const EDROP_BANK: BankPair[] = [
  ['making', 'makeing'], ['writing', 'writeing'], ['coming', 'comeing'], ['hoping', 'hopeing'],
  ['using', 'useing'], ['riding', 'rideing'], ['taking', 'takeing'], ['smiling', 'smileing'],
  ['caring', 'careing'], ['moving', 'moveing'], ['closing', 'closeing'], ['driving', 'driveing'],
  ['dancing', 'danceing'], ['arriving', 'arriveing'], ['deciding', 'decideing'],
  ['inviting', 'inviteing'], ['living', 'liveing'], ['saving', 'saveing'],
];

/**
 * edrop 예외 — -ee / -oe 는 e 를 남긴다(seeing · canoeing).
 * -ee 계열은 e 를 하나 빼도 여전히 '-eing' 으로 끝나(seeing → seing) 어긋난 쪽이
 * 접미사 대조를 못 깬다 → 옳은 쪽만 낸다. -oe 계열은 '-oing' 이 되어 양쪽 다 깬다.
 */
const EDROP_EXCEPTIONS: ExceptionSpec[] = [
  ['seeing', 'seing', 'valid'], ['agreeing', 'agreing', 'valid'], ['freeing', 'freing', 'valid'],
  ['fleeing', 'fleing', 'valid'], ['guaranteeing', 'guaranteing', 'valid'],
  ['decreeing', 'decreing', 'valid'], ['refereeing', 'refereing', 'valid'],
  ['canoeing', 'canoing', 'both'], ['tiptoeing', 'tiptoing', 'both'],
  ['hoeing', 'hoing', 'both'], ['shoeing', 'shoing', 'both'],
];

const DOUBLE_BANK: BankPair[] = [
  ['running', 'runing'], ['getting', 'geting'], ['swimming', 'swiming'], ['shopping', 'shoping'],
  ['beginning', 'begining'], ['cutting', 'cuting'], ['putting', 'puting'], ['hitting', 'hiting'],
  ['dropping', 'droping'], ['chatting', 'chating'], ['jogging', 'joging'], ['grabbing', 'grabing'],
  ['clapping', 'claping'], ['dragging', 'draging'], ['spinning', 'spining'], ['knitting', 'kniting'],
  ['forgetting', 'forgeting'], ['stepping', 'steping'],
];

/** double 예외 — 강세 없는 2음절 어미는 겹치지 않는다(visiting · opening). */
const DOUBLE_EXCEPTIONS: ExceptionSpec[] = [
  ['visiting', 'visitting', 'both'], ['opening', 'openning', 'both'],
  ['listening', 'listenning', 'both'], ['happening', 'happenning', 'both'],
  ['offering', 'offerring', 'both'], ['entering', 'enterring', 'both'],
  ['wondering', 'wonderring', 'both'], ['answering', 'answerring', 'both'],
  ['gardening', 'gardenning', 'both'], ['limiting', 'limitting', 'both'],
  ['delivering', 'deliverring', 'both'], ['covering', 'coverring', 'both'],
];

const IES_BANK: BankPair[] = [
  ['cities', 'citys'], ['stories', 'storys'], ['babies', 'babys'], ['families', 'familys'],
  ['countries', 'countrys'], ['studies', 'studys'], ['tries', 'trys'], ['copies', 'copys'],
  ['parties', 'partys'], ['armies', 'armys'], ['duties', 'dutys'], ['ladies', 'ladys'],
  ['bodies', 'bodys'], ['skies', 'skys'], ['diaries', 'diarys'], ['enemies', 'enemys'],
];

/** ies 예외 — **모음** 뒤의 y 는 그대로 -s (monkeys · keys). */
const IES_EXCEPTIONS: ExceptionSpec[] = [
  ['monkeys', 'monkies', 'both'], ['donkeys', 'donkies', 'both'], ['boys', 'boies', 'both'],
  ['toys', 'toies', 'both'], ['keys', 'kies', 'both'], ['guys', 'guies', 'both'],
  ['essays', 'essaies', 'both'], ['delays', 'delaies', 'both'],
  ['holidays', 'holidaies', 'both'], ['birthdays', 'birthdaies', 'both'],
  ['displays', 'displaies', 'both'], ['surveys', 'survies', 'both'],
];

const SIB_BANK: BankPair[] = [
  ['boxes', 'boxs'], ['dishes', 'dishs'], ['watches', 'watchs'], ['foxes', 'foxs'],
  ['taxes', 'taxs'], ['wishes', 'wishs'], ['churches', 'churchs'], ['brushes', 'brushs'],
  ['buses', 'buss'], ['benches', 'benchs'], ['matches', 'matchs'], ['beaches', 'beachs'],
  ['crashes', 'crashs'], ['mixes', 'mixs'], ['branches', 'branchs'], ['speeches', 'speechs'],
  ['flashes', 'flashs'],
];

/** sib 예외 — ch 가 /k/ 로 읽히거나(monarchs) 애초에 치찰음이 아닌 말(photos). */
const SIB_EXCEPTIONS: ExceptionSpec[] = [
  ['monarchs', 'monarches', 'both'], ['stomachs', 'stomaches', 'both'],
  ['epochs', 'epoches', 'both'], ['patriarchs', 'patriarches', 'both'],
  ['photos', 'photoes', 'both'], ['pianos', 'pianoes', 'both'],
  ['videos', 'videoes', 'both'], ['radios', 'radioes', 'both'],
  ['kilos', 'kiloes', 'both'], ['zoos', 'zooes', 'both'],
  ['roofs', 'roofes', 'both'], ['beliefs', 'beliefes', 'both'],
];

const FUL_BANK: BankPair[] = [
  ['careful', 'carefull'], ['helpful', 'helpfull'], ['grateful', 'gratefull'], ['useful', 'usefull'],
  ['beautiful', 'beautifull'], ['wonderful', 'wonderfull'], ['powerful', 'powerfull'],
  ['peaceful', 'peacefull'], ['successful', 'successfull'], ['thankful', 'thankfull'],
  ['meaningful', 'meaningfull'], ['colorful', 'colorfull'], ['painful', 'painfull'],
  ['harmful', 'harmfull'], ['awful', 'awfull'], ['hopeful', 'hopefull'],
];

/**
 * ful 예외 — 두 갈래다.
 *   ① 낱말 full·pull 은 접미사가 아니라 l 이 두 개다 → **옳은 쪽**이 접미사 대조를 깬다
 *      ('pul' 은 -ful 로 끝나지 않아 어긋난 쪽으로는 안 깨진다).
 *   ② -ful 을 붙일 때 y 는 i 로 바뀐다(duty → dutiful) → **어긋난 쪽** 'dutyful' 이
 *      -ful 로 끝나 접미사 대조에 그대로 걸린다.
 */
const FUL_EXCEPTIONS: ExceptionSpec[] = [
  ['full', 'ful', 'valid'], ['pull', 'pul', 'valid'], ['bull', 'bul', 'valid'],
  ['dull', 'dul', 'valid'], ['skull', 'skul', 'valid'], ['hull', 'hul', 'valid'],
  ['dutiful', 'dutyful', 'wrong'], ['pitiful', 'pityful', 'wrong'],
  ['merciful', 'mercyful', 'wrong'], ['plentiful', 'plentyful', 'wrong'],
  ['bountiful', 'bountyful', 'wrong'], ['fanciful', 'fancyful', 'wrong'],
];

const LLY_BANK: BankPair[] = [
  ['really', 'realy'], ['finally', 'finaly'], ['usually', 'usualy'], ['carefully', 'carefuly'],
  ['beautifully', 'beautifuly'], ['totally', 'totaly'], ['especially', 'especialy'],
  ['personally', 'personaly'], ['naturally', 'naturaly'], ['actually', 'actualy'],
  ['generally', 'generaly'], ['originally', 'originaly'], ['normally', 'normaly'],
  ['equally', 'equaly'], ['annually', 'annualy'], ['fully', 'fuly'],
];

/** lly 예외 — 어간이 l 로 끝나지 않으면 l 은 하나(quickly · truly). */
const LLY_EXCEPTIONS: ExceptionSpec[] = [
  ['quickly', 'quicklly', 'both'], ['slowly', 'slowlly', 'both'], ['badly', 'badlly', 'both'],
  ['sadly', 'sadlly', 'both'], ['nicely', 'nicelly', 'both'], ['simply', 'simplly', 'both'],
  ['truly', 'trully', 'both'], ['safely', 'safelly', 'both'], ['widely', 'widelly', 'both'],
  ['hardly', 'hardlly', 'both'], ['mainly', 'mainlly', 'both'], ['clearly', 'clearlly', 'both'],
];

/**
 * b + 'e' 가 실재하는 **동사**인 어간들.
 * 이 경우 b + 'ing' 은 그 동사의 옳은 -ing 형이므로(strip → striping = stripe 의 -ing)
 * 겹자음 규칙의 '어긋난 철자' 타일로 쓰면 그 단어를 아는 학습자만 손해를 보는 역-난이도가 된다.
 *
 * v07.10 반증 실측: 손 나열 목록에 strip · spit · scar · slat 이 빠져 있었다.
 * 손으로 더 적는 대신 "e 를 붙이면 동사가 되는 어간"이라는 **생성 규칙**으로 바꾼다 —
 * 같은 종류의 누락이 다시 생기지 않는다.
 */
const CVCE_VERB_STEMS = [
  'bar', 'bas', 'bat', 'bid', 'bik', 'bit', 'blam', 'bon', 'bor', 'brac', 'brib',
  'cag', 'cak', 'can', 'car', 'cas', 'cav', 'chan', 'chas', 'chok', 'cit', 'clos',
  'cod', 'com', 'con', 'cop', 'cur', 'dam', 'dar', 'dat', 'din', 'div', 'dop', 'dot', 'dup',
  'fac', 'fad', 'fak', 'fil', 'fin', 'fir', 'forc', 'gap', 'gaz', 'glid', 'grad', 'grip',
  'grop', 'hat', 'hid', 'hik', 'hir', 'hon', 'hop', 'jok', 'judg', 'lik', 'lin', 'liv',
  'lob', 'los', 'lur', 'mak', 'mat', 'min', 'mop', 'mov', 'nam', 'not', 'pac', 'pag',
  'par', 'pas', 'pav', 'phas', 'pil', 'pin', 'pip', 'plac', 'plan', 'plat', 'pok', 'pol',
  'pos', 'prob', 'prov', 'rag', 'rak', 'rat', 'rid', 'rob', 'rop', 'rul', 'sav', 'scal',
  'scar', 'scop', 'scrap', 'serv', 'shad', 'shak', 'shap', 'shar', 'shin', 'sit', 'skat',
  'slat', 'slid', 'slop', 'smil', 'smok', 'snip', 'solv', 'spac', 'spar', 'spik', 'spit',
  'stag', 'star', 'stat', 'stok', 'stop', 'stor', 'strip', 'tam', 'tap', 'tast', 'tim',
  'tir', 'ton', 'trac', 'trad', 'tun', 'typ', 'us', 'vot', 'wad', 'wag', 'wan', 'wast',
  'wav', 'win', 'wip', 'wir', 'writ',
];

const REAL_SINGLE_ING = new Set<string>([
  ...EDROP_BANK.map(([v]) => v),
  ...EDROP_EXCEPTIONS.map(([v]) => v),
  ...CVCE_VERB_STEMS.map((s) => `${s}ing`),
]);

/** -e 탈락 규칙을 적용하면 안 되는 단어(-eing 을 유지하거나 다른 단어와 충돌). */
const EDROP_SKIP = new Set(['singe', 'tinge', 'hinge', 'whinge', 'binge', 'age', 'dye', 'eye', 'ache']);

/** ch 가 /k/ 로 읽혀 -es 가 아니라 -s 를 붙이는 단어. */
const CH_AS_K = new Set([
  'stomach', 'monarch', 'epoch', 'ache', 'headache', 'mustache', 'anarch',
  'patriarch', 'matriarch', 'hierarch', 'eunuch', 'tech', 'mech',
]);

/**
 * 모음 + s 로 끝나지만 굴절 -es 를 붙일 수 없는 말.
 * 'was' → 'wases', 'has' → 'hases' 는 비단어인데 품사 태그가 verb 라 allows() 를 통과한다.
 */
const SIB_SKIP = new Set(['was', 'has', 'his', 'its', 'yes', 'thus', 'plus', 'alas', 'whereas']);

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
  if (CH_AS_K.has(b) || SIB_SKIP.has(b)) return null;

  // v07.10 반증: 아래 두 줄이 없어서 species → 'specieses', goods → 'goodses' 가
  // **옳은 철자 타일**로 출제됐다. 옳게 판단해 어둡게 둔 학습자가 오답으로 기록됐다.
  //   · 이미 -es / -is / -os 로 끝나면(clothes · series · basis · axis · chaos)
  //     -es 를 한 번 더 붙인 형태는 존재하지 않는다.
  //   · 자음 + s 로 끝나면(goods · news · means) 대개 이미 복수이거나 불가산이다.
  //   · 남는 것은 모음 + s(bus · gas · canvas · focus · virus · status)뿐 — 전부 -es 가 옳다.
  if (/(es|is|os)$/.test(b)) return null;
  if (/[^aeiou]s$/.test(b)) return null;

  const sibilant = /(x|ch|sh)$/.test(b) || /[aeiou]s$/.test(b);
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
    exceptions: IE_EXCEPTIONS,
    exceptionNote: '예외 — weird·their 처럼 c 없이 ei 인 말, science·ancient 처럼 c 뒤에 cie 인 말이 있다.',
  },
  {
    id: 'edrop',
    statement: 'drop the silent e before -ing',
    hint: '자음 + e 로 끝나면 e 를 빼고 -ing 를 붙인다',
    derive: deriveEdrop,
    bank: EDROP_BANK,
    exceptions: EDROP_EXCEPTIONS,
    exceptionNote: '예외 — -ee · -oe 로 끝나면 e 를 남긴다(seeing · canoeing).',
  },
  {
    id: 'double',
    statement: 'double the final consonant after a short vowel',
    hint: '1음절 단모음 + 단자음이면 그 자음을 겹치고 -ing',
    derive: deriveDouble,
    bank: DOUBLE_BANK,
    exceptions: DOUBLE_EXCEPTIONS,
    exceptionNote: '예외 — 마지막 음절에 강세가 없으면 겹치지 않는다(visiting · opening).',
  },
  {
    id: 'ies',
    statement: 'consonant + y becomes -ies',
    hint: '자음 뒤의 y 는 i 로 바꾸고 -es 를 붙인다',
    derive: deriveIes,
    bank: IES_BANK,
    exceptions: IES_EXCEPTIONS,
    exceptionNote: '예외 — y 앞이 모음이면 그대로 -s (monkeys · keys).',
  },
  {
    id: 'sib',
    statement: 'add -es after s, x, ch, sh',
    hint: '치찰음으로 끝나면 -s 가 아니라 -es',
    derive: deriveSib,
    bank: SIB_BANK,
    exceptions: SIB_EXCEPTIONS,
    exceptionNote: '예외 — ch 를 /k/ 로 읽으면 -s (monarchs), 치찰음이 아니면 애초에 -s (photos).',
  },
  {
    id: 'ful',
    statement: 'the suffix -ful keeps a single l',
    hint: 'full 이 아니라 -ful — l 은 하나뿐',
    derive: deriveFul,
    bank: FUL_BANK,
    exceptions: FUL_EXCEPTIONS,
    exceptionNote: '예외 — 규칙은 접미사 -ful 에만 걸린다. 낱말 full·pull 은 l 이 두 개다.',
  },
  {
    id: 'lly',
    statement: 'an l-final stem keeps both l before -ly',
    hint: 'real + ly = really — l 이 두 개',
    derive: deriveLly,
    bank: LLY_BANK,
    exceptions: LLY_EXCEPTIONS,
    exceptionNote: '예외 — 어간이 l 로 끝나지 않으면 l 은 하나(quickly · truly).',
  },
];

// ─── 덱 · 문 조립 ─────────────────────────────────────────────────────────

/** 덱 안에서 다루는 예외 쌍 — Pair 에 극성 정보가 붙은 것. */
export interface ExPair extends Pair {
  show: 'both' | 'valid' | 'wrong';
}

export interface Deck {
  /** 이번 판의 규칙 순서. 학습자 단어가 붙은 규칙이 앞으로 온다. */
  rules: RuleDef[];
  pairs: Record<string, Pair[]>;
  /** 규칙별 예외어 풀 — 디코이 공급원. */
  exceptions: Record<string, ExPair[]>;
  /**
   * 학습자 단어에서 만들어진 쌍의 총수.
   * 0 이면 이번 판에 내 단어가 한 개도 안 나온다 → 게임이 그 사실을 화면에 밝혀야 한다
   * (v07.10 반증 #5: 0 인데 아무 표시가 없어 '내 단어로 플레이했다'고 오인하게 만들었다).
   */
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
  const exceptions: Record<string, ExPair[]> = {};
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
    exceptions[rule.id] = rule.exceptions.map(([valid, wrong, show]) => ({ valid, wrong, show }));
  }

  const withMine = RULES.filter((r) => pairs[r.id].some((p) => p.src));
  const without = RULES.filter((r) => !pairs[r.id].some((p) => p.src));
  return { rules: [...shuffle(withMine), ...shuffle(without)], pairs, exceptions, mineCount };
}

export interface Tile {
  text: string;
  valid: boolean;
  /** 옳은 철자 — 리빌에서만 노출된다. */
  fix: string;
  src?: Word;
  /**
   * 이 문의 규칙 바깥에서 온 칸.
   *   exception — 이 규칙의 **예외어**. 접미사 대조로는 반드시 틀린다.
   *   foreign   — 다른 규칙의 어긋난 철자(예외 풀이 마르면 쓰는 보조 디코이).
   */
  outside?: { kind: 'exception' | 'foreign'; note: string };
}

export interface Gate {
  index: number;
  rule: RuleDef;
  evidence: {
    ok: string[];
    bad: { text: string; fix: string }[];
    /** 어긋난 예시 옆에 옳은 철자를 같이 보여줄지 — 앞 두 문(연습)에서만 true. */
    showFix: boolean;
  };
  tiles: Tile[];
  cols: number;
  /**
   * 봉인어. **직전 문이 남겨 둔 예비 쌍**(reserve)이다 — 그 문의 규칙에서 나왔지만
   * 증거에도 격자에도 한 번도 뜨지 않은 철자다. 지금 화면에 변환이 남아 있으면
   * 봉인은 판돈이 아니라 베껴 쓰기가 된다(v07.10 반증 #2).
   */
  seal: { prompt: string; answer: string; src?: Word; fromGate: number } | null;
  /**
   * 다음 문의 봉인어로 넘길 예비 쌍. 이 문의 규칙에서 **학습자 단어 우선**으로 한 쌍을
   * 먼저 떼어 두고 격자·증거를 채운다 — 그래야 봉인이 뱅크 단어로 새지 않고
   * 이 게임에서 유일한 '진짜 인출 = FSRS 정답 기록' 자리가 실제로 열린다.
   */
  reserve: { pair: Pair; fromGate: number } | null;
  /** 이번 문에 예외 칸이 있었으면 그 설명 — 리빌에서만 공개. */
  exceptionNote: string | null;
  /** 이번 문이 소비한 철자 — 다음 문에서 재탕을 피하는 데 쓴다. */
  keys: string[];
}

/**
 * 문 규격 — 뒤로 갈수록 칸이 늘고, 디코이가 들어오고, 증거가 줄어든다.
 *
 * v07.10 반증 #4: 예전 SHAPES 는 6개뿐이라 index 6 에서 clamp 되어 문 6·7·8 이 완전히
 * 같았다("난이도 곡선" 주장 불성립). MAX_GATES 와 같은 8개로 맞추고 마지막 두 문에서
 * 칸 9~10 · 증거 1~2 쌍까지 조인다. 칸 11 이상은 인지부하(동시 4항목 원칙) 대비
 * 판정 노동만 늘어나 의미가 없어 10 에서 멈춘다.
 */
const SHAPES = [
  { ok: 3, bad: 3, decoy: 0, ev: 3 }, // 6칸 — 규칙 자체를 읽는 문(유일한 무예외 구간)
  { ok: 3, bad: 3, decoy: 1, ev: 3 }, // 7칸 — 예외 1칸 등장
  { ok: 4, bad: 2, decoy: 1, ev: 2 }, // 7칸
  { ok: 4, bad: 2, decoy: 1, ev: 2 }, // 7칸
  { ok: 4, bad: 3, decoy: 1, ev: 2 }, // 8칸
  { ok: 4, bad: 2, decoy: 2, ev: 2 }, // 8칸 — 예외 2칸
  { ok: 4, bad: 3, decoy: 2, ev: 2 }, // 9칸
  { ok: 5, bad: 3, decoy: 2, ev: 1 }, // 10칸 · 증거 1쌍
];

export const MAX_GATES = 8;

/**
 * 예외 디코이가 처음 들어오는 문(0-based).
 * 첫 문 하나만 무예외로 남긴다 — 예외 없는 문이 둘이면 접미사 대조만으로 두 문을 완봉해
 * 콤보 ×2 까지 공짜로 올라간다(실측: 무예외 문의 무지 전략 완봉률 약 62%).
 */
const EXCEPTION_FROM_GATE = 1;

function take<T extends Pair>(
  list: T[],
  n: number,
  used: ReadonlySet<string>,
  taken: Set<string>,
  prefer: 'mine' | 'bank',
): T[] {
  if (n <= 0) return [];
  const free = (p: T) => !taken.has(p.valid) && !taken.has(p.wrong);
  const order = (src: T[]) => {
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

export function buildGate(
  deck: Deck,
  index: number,
  used: ReadonlySet<string>,
  carry: { pair: Pair; fromGate: number } | null,
): Gate {
  const ruleCount = Math.max(1, deck.rules.length);
  const rule = deck.rules[index % ruleCount];
  const shape = SHAPES[Math.min(index, SHAPES.length - 1)];
  const list = deck.pairs[rule.id] ?? [];
  const taken = new Set<string>();

  // ① 다음 문의 봉인어를 **먼저** 떼어 둔다 — 나중에 뽑으면 격자·증거가 학습자 단어를
  //    다 써 버려 봉인이 뱅크 단어로 새고, 그러면 이 게임에 진짜 인출 자리가 사라진다.
  //    다만 이 규칙에 학습자 쌍이 하나뿐이면 격자에 남긴다 — 예비로 빼 버리면
  //    "내 단어가 이번 판에 나왔다"가 화면에서 통째로 사라진다.
  const mineFree = list.filter((p) => !!p.src && !used.has(p.valid)).length;
  const reservePair = take(list, 1, used, taken, mineFree >= 2 ? 'mine' : 'bank')[0];

  // 증거는 뱅크 우선 — 채점되는 격자에 학습자 단어를 남긴다.
  const evOk = take(list, shape.ev, used, taken, 'bank');
  const evBad = take(list, shape.ev, used, taken, 'bank');
  const okPairs = take(list, shape.ok, used, taken, 'mine');
  const badPairs = take(list, shape.bad, used, taken, 'mine');

  const tiles: Tile[] = [
    ...okPairs.map((p) => ({ text: p.valid, valid: true, fix: p.valid, src: p.src })),
    ...badPairs.map((p) => ({ text: p.wrong, valid: false, fix: p.valid, src: p.src })),
  ];

  let decoysLeft = shape.decoy;
  let exceptionNote: string | null = null;

  // ── 예외 디코이 (v07.10 반증 #1 의 정면 대응) ──────────────────────────
  // 예전 디코이는 '다른 규칙의 어긋난 철자'였다. 그건 이 문의 접미사 서명과 애초에
  // 겹치지 않아 "끝 3글자가 옳은 예시와 같은 칸만 밝힌다"는 무지 전략을 **한 칸도**
  // 방해하지 못했다. 예외어는 반대다:
  //   valid  로 놓으면 → 옳은데 끝이 '어긋난 예시'와 같다  → 접미사 대조는 놓친다
  //   wrong  으로 놓으면 → 어긋났는데 끝이 '옳은 예시'와 같다 → 접미사 대조는 걸린다
  // 대부분의 예외는 어느 쪽으로 놓아도 접미사 대조를 깬다(show:'both' → 극성 무작위라
  // "예외 칸은 늘 옳다" 같은 메타 읽기가 서지 않는다). 한쪽만 깨는 예외는 그쪽으로 고정한다.
  const exKeys: string[] = [];
  if (decoysLeft > 0 && index >= EXCEPTION_FROM_GATE) {
    const exPairs = take(deck.exceptions[rule.id] ?? [], decoysLeft, used, taken, 'bank');
    for (const p of exPairs) {
      const asValid = p.show === 'both' ? Math.random() < 0.5 : p.show === 'valid';
      tiles.push({
        text: asValid ? p.valid : p.wrong,
        valid: asValid,
        fix: p.valid,
        outside: { kind: 'exception', note: rule.exceptionNote },
      });
      // 안 쓴 쪽도 소진 처리 — 3문에서 'monkeys'(옳음), 6문에서 'monkies'(어긋남)가
      // 따로 나오면 두 번째는 첫 번째를 본 사람에게 공짜 정답이 된다.
      exKeys.push(p.valid, p.wrong);
      decoysLeft -= 1;
      exceptionNote = rule.exceptionNote;
    }
  }

  // 예외 풀이 마르면(같은 규칙이 두 번 나온 판) 예전 방식으로 채운다.
  if (decoysLeft > 0) {
    for (const other of shuffle(deck.rules.filter((r) => r.id !== rule.id))) {
      if (decoysLeft <= 0) break;
      const p = take(deck.pairs[other.id] ?? [], 1, used, taken, 'bank')[0];
      if (!p) continue;
      tiles.push({
        text: p.wrong,
        valid: false,
        fix: p.valid,
        src: p.src,
        outside: { kind: 'foreign', note: other.statement },
      });
      decoysLeft -= 1;
    }
  }

  const ordered = shuffle(tiles);

  const keys = [
    ...evOk.map((p) => p.valid),
    ...evBad.map((p) => p.valid),
    ...ordered.flatMap((t) => [t.text, t.fix]),
    ...exKeys,
  ];
  if (reservePair) keys.push(reservePair.valid, reservePair.wrong);

  return {
    index,
    rule,
    evidence: {
      ok: evOk.map((p) => p.valid),
      bad: evBad.map((p) => ({ text: p.wrong, fix: p.valid })),
      // 어긋난 예시 옆의 '→ 옳은 철자'는 변환 자체를 그대로 넘겨주는 정보다.
      // 앞 두 문(연습)에서만 붙이고, 그 뒤로는 두 줄의 대조만으로 귀납하게 한다.
      showFix: index < 2,
    },
    tiles: ordered,
    cols: ordered.length <= 6 ? 3 : 4,
    seal: carry
      ? { prompt: carry.pair.wrong, answer: carry.pair.valid, src: carry.pair.src, fromGate: carry.fromGate }
      : null,
    reserve: reservePair ? { pair: reservePair, fromGate: index } : null,
    exceptionNote,
    keys,
  };
}
