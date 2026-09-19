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
//
// v07.11 — 작은 풀 대응(minWords 12 → 6).
//   실측으로 먼저 확인한 것: **격자는 애초에 풀 크기에 매인 적이 없다.** 내장 뱅크가
//   규칙마다 16~20쌍을 대므로 pool 0 에서도 6~10칸이 빈칸·중복 없이 찬다(sim: blank 0 ·
//   중복타일 0 · 증거유출 0). 풀에 매여 있던 것은 단 하나, **학습자 단어가 판에 등장하는가**
//   (deck.mineCount) 였고 minWords 12 는 그것 하나를 사려고 도서 챕터의 25.4% 를 거절했다.
//   그런데 12단어에서도 mineCount 0 은 9.7% 나 남았다 — 값을 치르고도 못 산 보험이다.
//
//   그래서 여기서 바꾼 것은 "입장 문턱"이 아니라 **단어 한 개당 파생률**이다.
//     · 품사·굴절형이 없어도 도는 규칙 4개 추가(softe · longv · ly1 · ous).
//       실 DB(shared_words 2,952 낱말)에서 품사 60% · 굴절형 61% 만 채워져 있어
//       굴절 기반 규칙(edrop·double·ies·sib)은 나머지 40% 를 통째로 버리고 있었다.
//       새 4개는 전부 valid = 학습자 단어 **그대로**, wrong 만 만들므로 굴절 판단이 없다.
//     · 규칙이 7 → 11 개(그중 상호배타 1개를 빼고 한 판에 10개)가 되어 8문 세션에서
//       같은 규칙이 두 번 도는 일이 사라졌다
//       (전에는 문 8 이 문 1 의 규칙을 재탕해 판당 1.4~1.8칸이 이미 본 철자였다).
//   그리고 문 규격(SHAPES 하드코딩 8줄)을 **진행률·공급량의 함수**로 바꿨다 —
//   문 수가 몇이든 증거 3→2→1 · 칸 6→10 곡선이 끝까지 돌고, 어느 규칙도 남은 쌍보다
//   많이 뽑지 않는다.

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

// ─── v07.11 신규 4규칙 — 품사·굴절형 없이 도는 것들 ──────────────────────
//
// 공통 설계: valid = **학습자 단어 그대로**, wrong 만 만든다.
// 굴절(-ing/-ies/-es)을 만들지 않으므로 품사 태그도 DB 굴절형도 필요 없다.
// 실 DB 에서 품사 60% · 굴절형 61% 만 채워져 있다는 것이 이 설계의 이유다.

/**
 * softe — 부드러운 c·g 와 어말 v 뒤의 e.
 * 파생 안전: -ce / -ge / -ve 로만 제한하고 **6글자 이상**만 받는다.
 *   · -se 를 뺀 이유 — browse→brows, cleanse→cleans 처럼 e 를 빼면 실재 복수형이 되는 말이 있다.
 *   · 6글자 미만을 뺀 이유 — huge→hug, rage→rag, wage→wag, stage→stag, use→us 가 전부 실재한다.
 *     6글자 이상에서는 notice→notic, change→chang, believe→believ … 전부 비단어다.
 */
const SOFTE_BANK: BankPair[] = [
  ['notice', 'notic'], ['office', 'offic'], ['police', 'polic'], ['balance', 'balanc'],
  ['silence', 'silenc'], ['service', 'servic'], ['chance', 'chanc'], ['sentence', 'sentenc'],
  ['village', 'villag'], ['message', 'messag'], ['change', 'chang'], ['courage', 'courag'],
  ['believe', 'believ'], ['improve', 'improv'], ['deserve', 'deserv'], ['observe', 'observ'],
  ['twelve', 'twelv'], ['achieve', 'achiev'],
];

/** softe 예외 — **딱딱한** c 로 끝나는 말에는 e 가 없다(music · public). 규칙은 부드러운 c·g 전용. */
const SOFTE_EXCEPTIONS: ExceptionSpec[] = [
  ['music', 'musice', 'both'], ['public', 'publice', 'both'], ['basic', 'basice', 'both'],
  ['traffic', 'traffice', 'both'], ['magic', 'magice', 'both'], ['panic', 'panice', 'both'],
  ['topic', 'topice', 'both'], ['plastic', 'plastice', 'both'], ['electric', 'electrice', 'both'],
  ['specific', 'specifice', 'both'], ['classic', 'classice', 'both'], ['logic', 'logice', 'both'],
];

/**
 * longv — 모음 글자가 둘이면 뒤 자음을 겹치지 않는다(reading, not readding).
 * 파생 안전: **자음을 겹치는 방향**이라 실재어 충돌이 구조적으로 없다.
 *   later/latter · diner/dinner · hoping/hopping 같은 고전적 충돌쌍은 전부 앞 모음이 **하나**다.
 *   모음 글자 두 개를 요구하는 순간 그 쌍들이 통째로 제외된다.
 */
const LONGV_BANK: BankPair[] = [
  ['reason', 'reasson'], ['season', 'seasson'], ['meaning', 'meanning'], ['reading', 'readding'],
  ['leader', 'leadder'], ['feeling', 'feelling'], ['sooner', 'soonner'], ['waiter', 'waitter'],
  ['creature', 'creatture'], ['feature', 'featture'], ['toilet', 'toillet'], ['boiler', 'boiller'],
  ['easier', 'eassier'], ['louder', 'loudder'], ['praised', 'praissed'], ['freedom', 'freeddom'],
];

/** longv 예외 — 모음이 하나뿐인 짧은 음절 뒤에서는 자음을 겹친다(running · summer). */
const LONGV_EXCEPTIONS: ExceptionSpec[] = [
  ['running', 'runing', 'both'], ['summer', 'sumer', 'both'], ['letter', 'leter', 'both'],
  ['button', 'buton', 'both'], ['lesson', 'leson', 'both'], ['happen', 'hapen', 'both'],
  ['follow', 'folow', 'both'], ['arrive', 'arive', 'both'], ['sudden', 'suden', 'both'],
  ['common', 'comon', 'both'], ['address', 'adress', 'both'], ['coffee', 'cofee', 'both'],
  ['terrible', 'terible', 'both'], ['different', 'diferent', 'both'],
];

/**
 * ly1 — 접미사 -ly 의 l 은 하나. (lly 규칙의 반대쪽 절반이고, 서로가 서로의 예외다.)
 * 파생 안전: **6글자 이상**만 받는다 — holy→holly, duly→dully, wily→willy 가 전부 실재한다.
 * 6글자 이상에서 -ly 의 l 을 겹친 형태는 비단어다(quicklly · familly · monthlly).
 */
const LY1_BANK: BankPair[] = [
  ['quickly', 'quicklly'], ['slowly', 'slowlly'], ['nearly', 'nearlly'], ['simply', 'simplly'],
  ['clearly', 'clearlly'], ['gladly', 'gladlly'], ['kindly', 'kindlly'], ['lonely', 'lonelly'],
  ['lovely', 'lovelly'], ['costly', 'costlly'], ['monthly', 'monthlly'], ['friendly', 'friendlly'],
  ['suddenly', 'suddenlly'], ['exactly', 'exactlly'], ['hardly', 'hardlly'], ['safely', 'safelly'],
];

/** ly1 예외 — 어간이 l 로 끝나면 l 이 둘이 된다(real + ly = really). */
const LY1_EXCEPTIONS: ExceptionSpec[] = [
  ['really', 'realy', 'both'], ['finally', 'finaly', 'both'], ['usually', 'usualy', 'both'],
  ['carefully', 'carefuly', 'both'], ['totally', 'totaly', 'both'], ['actually', 'actualy', 'both'],
  ['naturally', 'naturaly', 'both'], ['especially', 'especialy', 'both'],
  ['normally', 'normaly', 'both'], ['equally', 'equaly', 'both'], ['fully', 'fuly', 'both'],
  ['personally', 'personaly', 'both'],
];

/** ous — 형용사 어미는 -ous. -us 로 줄인 형태는 전부 비단어다(famus · dangerus). */
const OUS_BANK: BankPair[] = [
  ['famous', 'famus'], ['dangerous', 'dangerus'], ['nervous', 'nervus'], ['various', 'varius'],
  ['serious', 'serius'], ['obvious', 'obvius'], ['previous', 'previus'], ['curious', 'curius'],
  ['enormous', 'enormus'], ['generous', 'generus'], ['jealous', 'jealus'], ['delicious', 'delicius'],
  ['anxious', 'anxius'], ['precious', 'precius'], ['humorous', 'humorus'], ['religious', 'religius'],
];

/** ous 예외 — -us 로 끝나는 낱말(virus · focus)은 접미사가 아니라 어간의 일부다. */
const OUS_EXCEPTIONS: ExceptionSpec[] = [
  ['virus', 'virous', 'both'], ['focus', 'focous', 'both'], ['campus', 'campous', 'both'],
  ['bonus', 'bonous', 'both'], ['status', 'statous', 'both'], ['radius', 'radious', 'both'],
  ['circus', 'circous', 'both'], ['minus', 'minous', 'both'], ['chorus', 'chorous', 'both'],
  ['census', 'censous', 'both'], ['cactus', 'cactous', 'both'], ['surplus', 'surplous', 'both'],
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

/**
 * softe 파생을 막을 낱말 — e 를 빼면 실재하는(또는 사전에 실린) 형태가 되는 6글자 이상 -ce/-ge/-ve.
 * 6글자 하한이 huge·rage·wage·stage·use 를 이미 걸러 내므로 남는 것은 이 정도다.
 */
const SOFTE_SKIP = new Set(['orange', 'lozenge', 'syringe']);

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

/**
 * -ce / -ge / -ve 로 끝나는 6~15글자 낱말 → e 를 뺀 비단어.
 * 굴절이 없으므로 품사도 DB 굴절형도 보지 않는다 — 이것이 작은 풀에서 파생률을 올리는 핵심이다.
 */
function deriveSofte(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 6 || b.length > 15) return null;
  if (!/[cgv]e$/.test(b)) return null;
  if (SOFTE_SKIP.has(b)) return null;
  return { valid: b, wrong: b.slice(0, -1) };
}

/** 모음 글자 두 개 + 자음 + 모음 → 그 자음을 겹친 비단어. */
function deriveLongv(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 5 || b.length > 15) return null;
  // 이미 어딘가에 겹자음이 있으면 이 규칙의 증거로 쓰지 않는다 — 옳은 칸에 겹자음이 보이면
  // 규칙 문장("겹치지 않는다")과 화면이 어긋나 귀납이 흐려진다. 겹자음은 예외 칸의 몫이다.
  if (/([bcdfglmnprstz])\1/.test(b)) return null;
  const m = /[aeiou]{2}([bcdfgklmnprstvz])[aeiou]/.exec(b);
  if (!m) return null;
  const at = m.index + 2; // 겹칠 자음의 위치
  const c = b[at];
  return { valid: b, wrong: `${b.slice(0, at)}${c}${b.slice(at)}` };
}

/** -ly 로 끝나고 어간이 l 로 끝나지 않는 6글자 이상 낱말 → l 을 겹친 비단어. */
function deriveLy1(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 6 || b.length > 16) return null;
  if (!b.endsWith('ly') || b[b.length - 3] === 'l') return null;
  return { valid: b, wrong: `${b.slice(0, -2)}lly` };
}

/** -ous 로 끝나는 낱말 → -us 로 줄인 비단어. */
function deriveOus(w: Word): { valid: string; wrong: string } | null {
  const b = clean(w.en);
  if (!isPlain(b) || b.length < 5 || b.length > 16) return null;
  if (!b.endsWith('ous')) return null;
  return { valid: b, wrong: `${b.slice(0, -3)}us` };
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
  // ── v07.11 신규 — 굴절 없이(품사 태그·DB 굴절형 없이) 도는 규칙들 ──
  {
    id: 'softe',
    statement: 'soft c, soft g and final v are followed by e',
    hint: '-ce · -ge · -ve 의 끝 e 는 낱말의 일부다 — 빼면 안 된다',
    derive: deriveSofte,
    bank: SOFTE_BANK,
    exceptions: SOFTE_EXCEPTIONS,
    exceptionNote: '예외 — 딱딱한 c 로 끝나면 e 가 없다(music · public). 규칙은 부드러운 c·g 에만 걸린다.',
  },
  {
    id: 'longv',
    statement: 'two vowel letters keep the consonant single',
    hint: '모음 글자가 둘이면 뒤 자음을 겹치지 않는다 (reading, not readding)',
    derive: deriveLongv,
    bank: LONGV_BANK,
    exceptions: LONGV_EXCEPTIONS,
    exceptionNote: '예외 — 모음이 하나뿐인 짧은 음절 뒤에서는 자음을 겹친다(running · summer).',
  },
  {
    id: 'ly1',
    statement: 'the suffix -ly adds a single l',
    hint: '어간이 l 로 끝나지 않으면 -ly 의 l 은 하나뿐',
    derive: deriveLy1,
    bank: LY1_BANK,
    exceptions: LY1_EXCEPTIONS,
    exceptionNote: '예외 — 어간이 l 로 끝나면 l 이 둘이 된다(real + ly = really).',
  },
  {
    id: 'ous',
    statement: 'the adjective suffix is -ous, never -us',
    hint: 'famous · dangerous — 어미는 언제나 -ous',
    derive: deriveOus,
    bank: OUS_BANK,
    exceptions: OUS_EXCEPTIONS,
    exceptionNote: '예외 — -us 로 끝나는 낱말(virus · focus)은 접미사가 아니라 어간의 일부다.',
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
  /**
   * **봉인 담당 규칙** — 파생 쌍 분포의 함수 (v07.11).
   *
   * 봉인은 이 게임 유일의 비-assisted FSRS 인출 자리다(화면에 없는 규칙으로 철자를 손으로 생성).
   * 예전에는 "한 규칙이 학습자 쌍을 2개 이상 갖고 있을 때만" 봉인으로 돌렸는데,
   * 작은 풀에서는 파생 쌍이 규칙 여러 개에 1개씩 흩어져(예: softe 1 + ly1 1) 조건이
   * 영영 서지 않았다 — 즉 **판 전체에 진짜 인출이 0회**였다.
   *
   * 이제는 덱 전체를 보고 배정한다:
   *   mineRules = 학습자 쌍을 가진 규칙(쌍 많은 순)
   *   gridKeeper = 그중 가장 적게 가진 규칙 — 이 규칙의 쌍은 격자에 남긴다
   *                (전부 봉인으로 빼면 "내 단어가 판에 나왔다"가 화면에서 사라진다)
   *   sealRules = mineRules 중 (gridKeeper 가 아니거나 쌍이 2개 이상)인 규칙
   * D=1 → 격자 1칸 · 봉인 0 / D=2(규칙 둘) → 격자 1칸 · 봉인 1 / D=2(한 규칙) → 둘 다.
   */
  sealRules: Set<string>;
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

  const mineOf = (r: RuleDef) => pairs[r.id].filter((p) => p.src).length;

  /**
   * **상호 배타 규칙** — 한 판에 둘 중 하나만 연다.
   *
   * lly("어간이 l 로 끝나면 l 둘")와 ly1("-ly 의 l 은 하나")은 서로의 반쪽이라,
   * 한쪽의 뱅크가 다른 쪽의 예외 풀과 12개나 겹친다. 둘 다 열면
   *   ① 먼저 도는 문이 겹치는 철자를 소진해 나중 문의 공급이 16 → 4 로 말라
   *      take() 의 재탕 경로가 열리고(실측: 봉인 정답이 화면에 노출되는 판 1/200 발생),
   *   ② 학습자는 한 판에서 서로 반대로 들리는 두 문장을 연달아 읽는다.
   * 학습자 단어가 붙은 쪽을 남긴다 — 그쪽이 이 판에서 더 값이 나가는 규칙이다.
   */
  const MUTEX: string[][] = [['lly', 'ly1']];
  const dropped = new Set<string>();
  for (const group of MUTEX) {
    const defs = group.map((id) => RULES.find((r) => r.id === id)).filter((r): r is RuleDef => !!r);
    if (defs.length < 2) continue;
    const best = defs.reduce((a, b) => {
      const da = mineOf(a);
      const db = mineOf(b);
      if (da !== db) return da > db ? a : b;
      return Math.random() < 0.5 ? a : b;
    });
    for (const d of defs) if (d !== best) dropped.add(d.id);
  }

  const live = RULES.filter((r) => !dropped.has(r.id));
  const withMine = live.filter((r) => mineOf(r) > 0);
  const without = live.filter((r) => mineOf(r) === 0);

  // 봉인 담당 배정 — 쌍이 가장 적은 규칙 하나는 격자 담당으로 남긴다.
  const ranked = [...withMine].sort((a, b) => mineOf(b) - mineOf(a));
  const gridKeeper = ranked[ranked.length - 1];
  const sealRules = new Set(
    ranked.filter((r) => r !== gridKeeper || mineOf(r) >= 2).map((r) => r.id),
  );

  return {
    rules: [...shuffle(withMine), ...shuffle(without)],
    pairs,
    exceptions,
    mineCount,
    sealRules,
  };
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
    /** 어긋난 예시 옆에 옳은 철자를 같이 보여줄지 — 진행률 25% 미만(연습 구간)에서만 true. */
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
 * 한 판의 문 수 상한. 문 하나 = 규칙 하나이므로 실제 문 수는 gatesFor() 가 정한다.
 * 한 판에 열리는 규칙은 10개(전체 11개 − 상호배타로 뺀 1개)라 8문에서 규칙이 겹치지 않는다.
 */
export const MAX_GATES = 8;

/**
 * 이 판의 문 수 — **규칙 공급량의 함수**.
 *   gatesFor(deck) = clamp(deck.rules.length, 4, MAX_GATES)
 *
 * v07.10 까지는 문 수가 8 고정이고 규칙이 7개였다. index % 7 이 돌아 문 8 이 문 1 의 규칙을
 * 다시 열었고, 그 규칙의 쌍이 이미 12개쯤 소진돼 있어 **판당 1.4~1.8칸이 이미 본 철자**였다
 * (재탕은 '규칙을 읽었나'가 아니라 '아까 뭐였더라'를 재는 순간 이 게임이 아니게 된다).
 * 규칙이 11개가 된 지금 8문은 전부 서로 다른 규칙이고, 규칙이 줄어도 문이 따라 준다.
 */
export function gatesFor(deck: Deck): number {
  return Math.max(4, Math.min(MAX_GATES, deck.rules.length));
}

/** 진행률 — 문 수가 몇이든 0 → 1. 모든 곡선이 이 값의 함수라 짧은 판도 끝까지 조여든다. */
const progOf = (index: number, total: number) => (total <= 1 ? 1 : index / (total - 1));

/** 증거 쌍 수 — 진행률의 함수. 3 → 2 → 1. */
const evFor = (prog: number) => (prog < 0.34 ? 3 : prog < 0.75 ? 2 : 1);

/**
 * 어긋난 예시 옆의 '→ 옳은 철자'는 변환 자체를 통째로 넘겨주는 정보다.
 * 앞 25% 구간(연습)에서만 붙인다 — 8문이면 문 1~2, 4문이면 문 1.
 */
const showFixFor = (prog: number) => prog < 0.25;

/** 희망 칸 수 — 진행률의 함수. 6 → 10. 11칸 이상은 인지부하(동시 4항목) 대비 판정 노동만 는다. */
const boardFor = (prog: number) => 6 + Math.round(prog * 4);

/**
 * 예외(미끼) 칸 — **보드 크기의 함수**. clamp(round(tiles × 0.22), 1, 3).
 * 6칸 → 1 · 8칸 → 2 · 10칸 → 2. 보드가 작아져도 밀도가 1/6 아래로 떨어지지 않아
 * "끝 3글자가 옳은 예시와 같은 칸만 밝힌다"는 무지 전략이 작은 판에서 되살아나지 않는다.
 * (예외 풀은 규칙마다 12개 고정 — 학습자 풀 크기와 무관하게 공급된다.)
 */
const decoyFor = (tiles: number, index: number) =>
  index < EXCEPTION_FROM_GATE ? 0 : Math.max(1, Math.min(3, Math.round(tiles * 0.22)));

/**
 * 어긋난 칸 수 — 본문 칸 수의 함수 + **매 문 흔들림**.
 *   lo = 2 · hi = clamp(round(body × 0.5), 2, body − 3) · bad = lo..hi 균등
 *
 * 흔들림이 필요한 이유(소거법 차단): 예전 SHAPES 는 문 index 마다 ok/bad 가 고정이라
 * 두 번째 판부터 "문 3 은 옳은 칸이 정확히 4개"가 알려진 값이 됐다. 개수를 알면 마지막
 * 한두 칸이 소거로 정해진다. 이제 개수 자체가 매 문 달라지고, 예외 칸의 극성도 무작위라
 * 화면에서 '옳은 칸이 몇 개'를 셀 수 없다.
 * 하한 2 · 상한 body−3 은 "전부 옳다 / 전부 어긋났다"를 구조적으로 배제한다 —
 * 그 두 경우가 바로 한 칸도 판단하지 않고 전부 밝히거나 전부 두는 것으로 완봉이 나는 판이다.
 */
const badFor = (body: number) => {
  const lo = 2;
  const hi = Math.max(lo, Math.min(body - 3, Math.round(body * 0.5)));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};

/**
 * 예외 디코이가 처음 들어오는 문(0-based).
 * 첫 문 하나만 무예외로 남긴다 — 예외 없는 문이 둘이면 접미사 대조만으로 두 문을 완봉해
 * 콤보 ×2 까지 공짜로 올라간다(실측: 무예외 문의 무지 전략 완봉률 약 62%).
 */
const EXCEPTION_FROM_GATE = 1;

/** 이 규칙에서 아직 한 번도 쓰지 않은 쌍의 수 — 문 규격의 공급 상한이다. */
function availOf<T extends Pair>(list: T[], used: ReadonlySet<string>): number {
  return list.filter((p) => !used.has(p.valid) && !used.has(p.wrong)).length;
}

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
  const fresh = (p: T) => !used.has(p.valid) && !used.has(p.wrong);
  const out = order(list.filter((p) => free(p) && fresh(p))).slice(0, n);
  if (out.length < n) {
    // 공급이 마르면 재탕한다 — 빈칸보다는 낫다. 다만 문 규격을 availOf() 로 미리 깎아
    // 두었으므로 정상 경로에서는 여기로 오지 않는다(시뮬 실측: pool 0~16 전 구간 0회).
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
  total: number = MAX_GATES,
): Gate {
  const ruleCount = Math.max(1, deck.rules.length);
  const rule = deck.rules[index % ruleCount];
  const list = deck.pairs[rule.id] ?? [];
  const taken = new Set<string>();

  // ── 문 규격 — 진행률과 **남은 공급량**의 함수 ────────────────────────────
  const prog = progOf(index, total);
  const avail = availOf(list, used);
  // 증거 2·ev 쌍 + 봉인 예비 1쌍을 먼저 떼고 남는 것이 격자에 쓸 수 있는 전부다.
  const ev = Math.max(1, Math.min(evFor(prog), Math.floor((avail - 5) / 2)));
  const board = boardFor(prog);
  const decoy = decoyFor(board, index);
  const supply = Math.max(4, avail - 1 - 2 * ev);
  const body = Math.max(4, Math.min(board - decoy, supply));
  const badCount = badFor(body);
  const okCount = body - badCount;

  // ① 다음 문의 봉인어를 **먼저** 떼어 둔다 — 나중에 뽑으면 격자·증거가 학습자 단어를
  //    다 써 버려 봉인이 뱅크 단어로 새고, 그러면 이 게임에 진짜 인출 자리가 사라진다.
  //    누가 봉인을 맡고 누가 격자를 맡는지는 덱이 파생 쌍 분포를 보고 정해 둔다(deck.sealRules).
  const mineFree = list.filter((p) => !!p.src && !used.has(p.valid)).length;
  const reserveWants = deck.sealRules.has(rule.id) && mineFree >= 1 ? 'mine' : 'bank';
  const reservePair = take(list, 1, used, taken, reserveWants)[0];

  // 증거는 뱅크 우선 — 채점되는 격자에 학습자 단어를 남긴다.
  const evOk = take(list, ev, used, taken, 'bank');
  const evBad = take(list, ev, used, taken, 'bank');
  const okPairs = take(list, okCount, used, taken, 'mine');
  const badPairs = take(list, badCount, used, taken, 'mine');

  const tiles: Tile[] = [
    ...okPairs.map((p) => ({ text: p.valid, valid: true, fix: p.valid, src: p.src })),
    ...badPairs.map((p) => ({ text: p.wrong, valid: false, fix: p.valid, src: p.src })),
  ];

  let decoysLeft = decoy;
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

  // 증거로 쓴 쌍은 **양쪽 철자 모두** 소진 처리한다. valid 만 넣으면 문 2 에서 어긋난 예시로
  // 보여 준 'citys' 가 문 5 의 격자 칸으로 다시 나올 수 있다 — 그건 규칙이 아니라 기억을 재는 칸이다.
  const keys = [
    ...evOk.flatMap((p) => [p.valid, p.wrong]),
    ...evBad.flatMap((p) => [p.valid, p.wrong]),
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
      // 앞 25% 구간(연습)에서만 붙이고, 그 뒤로는 두 줄의 대조만으로 귀납하게 한다.
      showFix: showFixFor(prog),
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
