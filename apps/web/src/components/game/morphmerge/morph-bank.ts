// apps/web/src/components/game/morphmerge/morph-bank.ts
// Morphmerge 데이터·라운드 생성 — 순수 로직(컴포넌트 없음).
//
// 여기서 지키는 세 가지 원칙:
//   1) 학습자 자료 우선. wordPool 에서 어족(원형+굴절형)을 만들고, 굴절형이 없는
//      스코프 단어도 버리지 않고 **방해 타일**로 판에 올린다. 내장 뱅크는 스코프
//      어족이 모자랄 때만, 그것도 **정해진 수량까지만** 보충으로 섞인다.
//   2) 정답 누출 차단. 방해 타일은 (a) 대상 어족의 어떤 형태도 아니고 (b) 대상 원형의
//      규칙 활용/파생형으로 보이지도 않으며 (c) 다른 어족이라도 대상과 뜻이 겹치면 제외한다.
//      "미등재 규칙형"(예: 사전에 없는 goes)을 오답으로 몰아 억울하게 만들지 않기 위한 장치.
//   3) **어간 스캔 무력화**(v07.10). (2) 만으로는 부족했다 — 대상 어간을 공유하는 비정답
//      타일이 구조적으로 0개라, 보드에서 "앞 3~4글자가 같은 N개 묶음"이 곧 정답이었다.
//      이제 라운드마다 **대상과 같은 크기의 라이벌 어간 묶음**을 최소 1개(2형태 라운드는 2개)
//      강제로 깔고, 봇과 **같은 탐지기**(stemGroups)로 보드를 검사해 모호성을 확인한 뒤에만
//      내보낸다. 뜻을 아는 사람은 그대로 100% 지만, 어간만 보는 눈에는 답이 갈라진다.
//
//      측정(실 세트 shared_word_sets 079862e9 상위 40단어 = 어족 32개, 각 14,000판,
//      접두 길이 3~9 를 전부 훑고 '원형 제외' 칩까지 대조하는 최선의 스캔 봇):
//        한국어 미사용 봇 완성률  79.0% → 37.8%
//        N별  2형태 68.8→30.2 · 3형태 94.5→49.0 · 4형태 99.5→54.2 · 5형태 100→50.2
//        판 크기 평균 12.7 → 12.8 타일(최대 15 유지) — 인지부하는 올리지 않았다.
//      같은 시뮬에서 라운드마다 (a) 정답 전 형태가 보드에 있고 (b) 타일 중복이 없고
//      (c) 대상 어족의 다른 형태가 방해로 올라가지 않음을 42,000판 전수 확인했다.

import type { Word } from '@/components/game/_shared/gamekit';

export const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export interface Family {
  /** 원형(clean). 어족 식별자. */
  lemma: string;
  ko: string;
  /** 원형이 항상 [0]. 최대 5형태(보드 과밀 방지). */
  forms: string[];
  example?: string;
  /** 학습자 자료(wordPool) 유래 = FSRS 적재 대상 */
  scoped: boolean;
  /** onCorrect/onWrong 에 넘길 원본 */
  word: Word;
}

interface Filler {
  form: string;
  scoped: boolean;
}

export interface BuiltPool {
  families: Family[];
  fillers: Filler[];
  /** 형태 문자열 → 그 형태를 가진 원형들. 오귀속(예: 대상이 go 인데 went 를 방해로) 차단용. */
  owners: Map<string, Set<string>>;
  /** 스코프 어족만으로 판이 도는가 — 라벨/판단용 */
  scopeOnly: boolean;
  /** 스코프 유래 어족 수 */
  scopedCount: number;
}

// ─── 내장 뱅크 ─────────────────────────────────────────────────────────────
// 불규칙 활용·불규칙 복수 위주. 접두 문자열 스캔이 통하지 않는 어족(went/gone,
// feet, mice …)이 이 게임의 학습 핵심이라 뱅크도 그쪽으로 몰아 구성했다.
// 스코프 단어가 굴절형을 못 가져올 때만 등판한다.
const BANK: { lemma: string; ko: string; forms: string[]; example: string }[] = [
  { lemma: 'go', ko: '가다', forms: ['go', 'goes', 'going', 'went', 'gone'], example: 'We must go before the rain starts.' },
  { lemma: 'take', ko: '가져가다', forms: ['take', 'takes', 'taking', 'took', 'taken'], example: 'Please take an umbrella with you.' },
  { lemma: 'write', ko: '글을 쓰다', forms: ['write', 'writes', 'writing', 'wrote', 'written'], example: 'She writes a letter every Sunday.' },
  { lemma: 'begin', ko: '시작하다', forms: ['begin', 'begins', 'beginning', 'began', 'begun'], example: 'The concert begins at seven.' },
  { lemma: 'know', ko: '알다', forms: ['know', 'knows', 'knowing', 'knew', 'known'], example: 'I knew the answer at once.' },
  { lemma: 'grow', ko: '자라다', forms: ['grow', 'grows', 'growing', 'grew', 'grown'], example: 'These trees grow very slowly.' },
  { lemma: 'throw', ko: '던지다', forms: ['throw', 'throws', 'throwing', 'threw', 'thrown'], example: 'He threw the ball over the fence.' },
  { lemma: 'blow', ko: '바람이 불다', forms: ['blow', 'blows', 'blowing', 'blew', 'blown'], example: 'The wind blew all night.' },
  { lemma: 'see', ko: '보다', forms: ['see', 'sees', 'seeing', 'saw', 'seen'], example: 'I have seen that film twice.' },
  { lemma: 'give', ko: '주다', forms: ['give', 'gives', 'giving', 'gave', 'given'], example: 'She gave me her seat.' },
  { lemma: 'break', ko: '깨뜨리다', forms: ['break', 'breaks', 'breaking', 'broke', 'broken'], example: 'The glass broke on the floor.' },
  { lemma: 'speak', ko: '말하다', forms: ['speak', 'speaks', 'speaking', 'spoke', 'spoken'], example: 'He spoke quietly to the child.' },
  { lemma: 'ring', ko: '종이 울리다', forms: ['ring', 'rings', 'ringing', 'rang', 'rung'], example: 'The bell rang twice.' },
  { lemma: 'sing', ko: '노래하다', forms: ['sing', 'sings', 'singing', 'sang', 'sung'], example: 'They sang together on the stage.' },
  { lemma: 'drink', ko: '마시다', forms: ['drink', 'drinks', 'drinking', 'drank', 'drunk'], example: 'She drank a glass of water.' },
  { lemma: 'swim', ko: '헤엄치다', forms: ['swim', 'swims', 'swimming', 'swam', 'swum'], example: 'We swam across the lake.' },
  { lemma: 'ride', ko: '올라타다', forms: ['ride', 'rides', 'riding', 'rode', 'ridden'], example: 'He rode his bicycle to school.' },
  { lemma: 'drive', ko: '운전하다', forms: ['drive', 'drives', 'driving', 'drove', 'driven'], example: 'She drove home in the dark.' },
  { lemma: 'choose', ko: '고르다', forms: ['choose', 'chooses', 'choosing', 'chose', 'chosen'], example: 'You may choose either seat.' },
  { lemma: 'freeze', ko: '얼다', forms: ['freeze', 'freezes', 'freezing', 'froze', 'frozen'], example: 'The pond froze overnight.' },
  { lemma: 'shake', ko: '흔들다', forms: ['shake', 'shakes', 'shaking', 'shook', 'shaken'], example: 'The wind shook the windows.' },
  { lemma: 'bring', ko: '데려오다', forms: ['bring', 'brings', 'bringing', 'brought'], example: 'Bring your notes to class.' },
  { lemma: 'catch', ko: '붙잡다', forms: ['catch', 'catches', 'catching', 'caught'], example: 'He caught the falling cup.' },
  { lemma: 'teach', ko: '가르치다', forms: ['teach', 'teaches', 'teaching', 'taught'], example: 'She taught us for three years.' },
  { lemma: 'fight', ko: '싸우다', forms: ['fight', 'fights', 'fighting', 'fought'], example: 'They fought over a small thing.' },
  { lemma: 'child', ko: '아이', forms: ['child', 'children'], example: 'The children ran into the yard.' },
  { lemma: 'foot', ko: '발', forms: ['foot', 'feet'], example: 'My feet ache after the long walk.' },
  { lemma: 'tooth', ko: '치아', forms: ['tooth', 'teeth'], example: 'The child lost two teeth.' },
  { lemma: 'mouse', ko: '생쥐', forms: ['mouse', 'mice'], example: 'Three mice lived under the floor.' },
  { lemma: 'leaf', ko: '나뭇잎', forms: ['leaf', 'leaves'], example: 'The leaves turned red in October.' },
  { lemma: 'knife', ko: '칼', forms: ['knife', 'knives'], example: 'He sharpened both knives.' },
  { lemma: 'woman', ko: '여자', forms: ['woman', 'women'], example: 'Two women waited at the gate.' },
];

export const BANK_FAMILIES: Family[] = BANK.map((b) => ({
  lemma: b.lemma,
  ko: b.ko,
  forms: b.forms,
  example: b.example,
  scoped: false,
  word: { en: b.lemma, ko: b.ko, example: b.example },
}));

// 어느 뱅크 어족의 형태도 아닌 **실재 단어**들. 철자가 닮아 접두 스캔을 무너뜨리는
// 함정 전용 타일(knot↔known · singe↔sing · mouth↔mouse …). 가짜 단어는 절대 넣지 않는다 —
// 학습자가 존재하지 않는 철자를 눈에 담게 되는 것은 학습 손해다.
const DECOYS = [
  'knot', 'knots', 'growl', 'growls', 'blot', 'blots', 'seed', 'seeds',
  'tool', 'tools', 'feed', 'feeds', 'mend', 'mends', 'ridge', 'ridges',
  'drift', 'drifts', 'singe', 'swing', 'swings', 'brink', 'thread', 'threads',
  'breath', 'breaths', 'chime', 'chimes', 'food', 'foods', 'booth', 'booths',
  'mouth', 'mouths', 'leap', 'leaps', 'knight', 'knights', 'chill', 'chills',
  'woven', 'wooden', 'gravel', 'shard', 'shards', 'stumble', 'stumbles',
];

/**
 * 스코프 어족이 이 수 이상이면 내장 뱅크를 아예 섞지 않는다.
 *
 * 4 → 8 로 올렸다. 근거: 100초 세션은 시간 가산까지 받아도 대략 18~24 라운드다.
 * 어족이 4개뿐이면 같은 어족을 5회 이상 다시 만나고, 첫 회에 답을 열람한 뒤
 * 나머지를 순수 암기로 도는 루프가 성립했다(적대적 감사 익스플로짓 5).
 * 8개면 재출제가 어족당 2~3회로 떨어져 루프의 초기 투자 대비 이득이 사라진다.
 */
export const SCOPE_ONLY_MIN = 8;

/** 스코프 어족이 0개(비로그인·굴절형 전무)일 때만 도는 맛보기 판의 뱅크 어족 수. */
const BANK_DEMO_MAX = 12;

/**
 * 내장 뱅크를 몇 어족까지 섞을지.
 *
 * 이전에는 스코프 어족 < 4 이면 뱅크 32개가 통째로 들어갔다. 그러면 bag 이 36 이라
 * 한 세션(약 20라운드)이 bag 한 바퀴도 못 돌고, 학습자 자기 단어는 11% 확률로만
 * 출제됐다(실측 653 세트 중 82개가 이 경로). 뱅크 단어는 vocabularies 에 없어
 * recordGameResult 가 silent skip 하므로 그 판은 FSRS 적재가 사실상 0이었다.
 *
 * 규칙: (a) 어족 수를 SCOPE_ONLY_MIN 까지 채우는 만큼만, (b) 스코프 어족 수의 2배를
 * 넘지 않게. 그리고 refillBag 이 **스코프 블록을 먼저** 돌리므로, 어떤 세트에서든
 * 학습자의 모든 어족이 매 사이클 앞쪽에서 반드시 한 번씩 출제된다.
 *
 * 실측 스코프 출제 비중(bag 한 바퀴 기준): 어족 1개 6%→33% · 2개 11%→33% ·
 * 3개 16%→38% · 4개 100%→50% · 6개 100%→75%.
 * 4~7개 구간에서 비중이 내려간 것은 의도한 교환이다 — recordGameResult 의 10분 재채점
 * 쿨다운 때문에 한 세션의 FSRS 기록 수는 어차피 **스코프 어족 수**가 상한이고(시뮬에서
 * 두 판 모두 전부 기록됨), 남는 라운드를 같은 4개로 채우면 답을 외워 도는 루프가 된다.
 * 뱅크로 채운 라운드는 기록에 남지 않는 대신 '보충 낱말' 칩으로 명시한다.
 */
function bankQuota(scoped: number): number {
  if (scoped === 0) return BANK_DEMO_MAX;
  return Math.max(0, Math.min(SCOPE_ONLY_MIN - scoped, scoped * 2));
}

// ─── 풀 구성 ───────────────────────────────────────────────────────────────
export function buildPool(pool?: Word[]): BuiltPool {
  const scopeFamilies: Family[] = [];
  const scopeFillers: Filler[] = [];
  const takenLemma = new Set<string>();

  for (const w of pool ?? []) {
    const base = clean(w.en ?? '');
    if (base.length < 2 || takenLemma.has(base)) continue;
    takenLemma.add(base);
    const ko = (w.ko ?? '').trim();
    const inf = Array.from(
      new Set((w.inflected ?? []).map(clean).filter((f) => f.length >= 2 && f !== base)),
    );
    if (ko && inf.length >= 1) {
      scopeFamilies.push({
        lemma: base,
        ko,
        forms: [base, ...inf].slice(0, 5),
        example: w.example,
        scoped: true,
        word: w,
      });
    } else {
      // 굴절형이 없어 어족은 못 되지만 **학습자 자료**다 — 방해 타일로 판에 올린다.
      scopeFillers.push({ form: base, scoped: true });
    }
  }

  const scopeOnly = scopeFamilies.length >= SCOPE_ONLY_MIN;
  const quota = bankQuota(scopeFamilies.length);
  const bankUsable = shuffleLocal(BANK_FAMILIES.filter((f) => !takenLemma.has(f.lemma))).slice(0, quota);
  const families = [...scopeFamilies, ...bankUsable];

  const fillers: Filler[] = [...scopeFillers];
  const fillerSeen = new Set(scopeFillers.map((f) => f.form));
  for (const d of DECOYS) {
    if (fillerSeen.has(d)) continue;
    fillerSeen.add(d);
    fillers.push({ form: d, scoped: false });
  }

  // owners 는 **쓰이지 않는 뱅크 어족까지** 포함한다 — 방해 후보가 대상의 다른 형태와
  // 겹치는 경우를 뱅크 지식으로도 걸러내기 위해서.
  const owners = new Map<string, Set<string>>();
  for (const f of [...scopeFamilies, ...BANK_FAMILIES]) {
    for (const form of f.forms) {
      const s = owners.get(form) ?? new Set<string>();
      s.add(f.lemma);
      owners.set(form, s);
    }
  }

  return { families, fillers, owners, scopeOnly, scopedCount: scopeFamilies.length };
}

/**
 * 가방(bag). **스코프 블록을 먼저, 뱅크 블록을 뒤에** 놓는다.
 *
 * 이전 구현은 스코프를 2배 가중해 섞기만 했다. 가중은 확률만 올릴 뿐 순서를 보장하지
 * 못해서, 뱅크가 많이 섞인 판에서는 학습자 단어가 세션이 끝날 때까지 안 나오기도 했다
 * (bag 36 vs 세션 약 20라운드). 블록 순서로 바꾸면 **모든 스코프 어족이 매 사이클
 * 앞쪽에서 정확히 한 번씩** 출제된다 — FSRS 에 올라갈 기회를 어휘별로 균등하게 준다.
 * (2배 가중은 오히려 같은 단어를 연달아 내밀어 인접 중복 처리 부담만 늘렸다.)
 *
 * 같은 어족이 바로 다음 판에 또 나오지 않게 인접 중복도 한 번 훑어 흩는다 —
 * 같은 단어로 onWrong 이 도배되는 것을 막는 장치이기도 하다.
 */
export function refillBag(families: Family[], prevLemma: string | null): Family[] {
  const bag = [
    ...shuffleLocal(families.filter((f) => f.scoped)),
    ...shuffleLocal(families.filter((f) => !f.scoped)),
  ];

  for (let i = 1; i < bag.length; i++) {
    if (bag[i].lemma !== bag[i - 1].lemma) continue;
    const swapAt = bag.findIndex(
      (f, j) => j > i && f.lemma !== bag[i - 1].lemma && (j + 1 >= bag.length || bag[j + 1].lemma !== f.lemma),
    );
    if (swapAt > 0) {
      const tmp = bag[i];
      bag[i] = bag[swapAt];
      bag[swapAt] = tmp;
    }
  }
  if (bag.length > 1 && bag[0].lemma === prevLemma) {
    const swapAt = bag.findIndex((f) => f.lemma !== prevLemma);
    if (swapAt > 0) {
      const tmp = bag[0];
      bag[0] = bag[swapAt];
      bag[swapAt] = tmp;
    }
  }
  return bag;
}

function shuffleLocal<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 난이도 램프 ───────────────────────────────────────────────────────────
// 세션이 진행될수록 (a) 판이 커지고 (b) 방해가 대상과 닮아가고 (c) 원형이 사라진다.
// (c) 가 이 게임의 클라이맥스다 — 원형이 없으면 접두 스캔이 통하지 않고, 굴절형만 보고
// 어떤 낱말인지 역추론해야 한다.
export function boardSizeFor(solved: number): number {
  if (solved < 2) return 9;
  if (solved < 5) return 11;
  if (solved < 9) return 13;
  return 15;
}
export function decoyBiasFor(solved: number): boolean {
  return solved >= 2;
}
export function dropBaseChanceFor(solved: number): number {
  if (solved < 5) return 0;
  if (solved < 9) return 0.5;
  return 0.62;
}

// ─── 라운드 ────────────────────────────────────────────────────────────────
export interface Round {
  id: number;
  fam: Family;
  /** 이번 라운드에 모아야 하는 형태(원형이 빠질 수 있다). */
  answer: string[];
  /** 보드에서 통째로 뺀 원형(없으면 null). */
  dropped: string | null;
  /** 셔플된 보드 타일. */
  tiles: string[];
  /**
   * 보드에 함께 깔린 **가짜 어간 묶음**의 수(정답 묶음 제외).
   * 어간만 보는 눈에게 답이 몇 갈래로 보이는지 = 1/(1+rivals) 이 봇 상한이다.
   */
  rivals: number;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
function commonSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * form 이 lemma 의 규칙 활용/파생형으로 **보이는가**.
 *
 * 사전에 미등재된 규칙형(예: shared_dictionary 에 goes 가 없는 경우)이 다른 어휘 항목으로
 * 들어와 방해 타일이 되면, 학습자는 맞는 답을 골랐는데 오답 처리된다. 그 억울함을 막는
 * 형태론 가드다. 접두 일치만 보던 이전 판(`form.startsWith(lemma)`)은
 * make→making, category→categories 처럼 **철자가 바뀌는** 규칙형을 놓쳤고,
 * 반대로 go→gold 같은 무관한 실재어까지 싸잡아 막아 어간 스캔의 먹이가 됐다.
 */
export function isLikelyInflection(lemma: string, form: string): boolean {
  if (form === lemma) return true;
  const tails = new Set<string>();
  if (form.startsWith(lemma)) tails.add(form.slice(lemma.length));
  // 어미 e 탈락 (make → making) · y → i (category → categories)
  if ((lemma.endsWith('e') || lemma.endsWith('y')) && form.startsWith(lemma.slice(0, -1))) {
    tails.add(form.slice(lemma.length - 1));
  }
  // 마지막 자음 중복 (stop → stopping)
  const last = lemma.slice(-1);
  if (last && form.startsWith(lemma + last)) tails.add(form.slice(lemma.length + 1));
  for (const t of tails) if (t.length > 0 && INFLECTION_TAILS.has(t)) return true;
  return false;
}

/** 굴절 + 아주 흔한 파생 접미. 파생형까지 막는 이유는 "같은 낱말 가족"으로 읽히기 때문. */
const INFLECTION_TAILS = new Set([
  's', 'es', 'd', 'ed', 'ing', 'ings', 'er', 'ers', 'est',
  'ies', 'ied', 'ier', 'iest', 'y', 'en', 'ens', 'ened',
  'ly', 'ness', 'ment', 'ments', 'tion', 'sion', 'ion', 'ions',
  'able', 'ible', 'ance', 'ence', 'ity', 'ties',
  'ful', 'less', 'ish', 'ous', 'al', 'ive', 'ize', 'ise', 'ized', 'ised',
]);

/** 대상 어간을 공유하는 **실재 비관련어**(go↔gold)를 이 수까지만 깐다. */
const MAX_STEM_SHARED = 2;

/** 뜻 비교용 꼬리 — "인식/인식하다", "정확/정확한" 을 같은 뜻으로 보게 한다. */
const KO_TAIL = /(하다|되다|시키다|롭다|스럽다|적인|하기|적|인|의|한|히)$/;

function koKeys(ko: string): string[] {
  return ko
    .split(/[,;·()/]/)
    .map((s) => s.replace(/\s+/g, ''))
    .map((s) => s.replace(KO_TAIL, ''))
    .filter((s) => s.length >= 2);
}

/**
 * 두 어족의 뜻이 포개지는가.
 *
 * 라이벌 묶음을 **일부러** 깔게 된 이상(어간 스캔 차단), 뜻 겹침 판정을 문자열 포함
 * 하나로 두면 불공정이 생긴다 — "인식하다, 지각하다"(perceive) 를 물었는데
 * "인식, 지각"(perception) 형태가 라이벌로 깔리면 뜻만 아는 학습자가 진다.
 * 어절 단위로 쪼개고 한국어 어미를 떼서 비교한다.
 */
function koOverlaps(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const set = new Set(koKeys(a));
  for (const k of koKeys(b)) if (set.has(k)) return true;
  return false;
}

/**
 * 봇과 동일한 탐지기 — 접두 길이 3~9 의 모든 묶음 중 크기가 n 인 것을 전부 모은다.
 * 라운드를 내보내기 전에 이걸로 "정답 말고도 같은 모양의 묶음이 있는가"를 확인한다.
 */
export function stemGroups(tiles: string[], n: number): string[][] {
  const out = new Map<string, string[]>();
  for (let L = 3; L <= 9; L++) {
    const g = new Map<string, string[]>();
    for (const t of tiles) {
      if (t.length < L) continue;
      const k = t.slice(0, L);
      const arr = g.get(k);
      if (arr) arr.push(t);
      else g.set(k, [t]);
    }
    for (const arr of g.values()) {
      if (arr.length !== n) continue;
      const key = [...arr].sort().join('|');
      if (!out.has(key)) out.set(key, arr);
    }
  }
  return [...out.values()];
}

/** 묶음 안에 "나머지 전원의 접두가 되는 원형"이 있는가 — '원형 제외' 칩과 대조되는 신호. */
function hasBaseForm(group: string[]): boolean {
  return group.some((a) => group.every((b) => b === a || b.startsWith(a)));
}

/** 정답 묶음과 **구분되지 않는**(크기 동일 + 원형 유무 동일) 가짜 묶음 수. */
function decoyGroupCount(tiles: string[], answer: string[]): number {
  const want = hasBaseForm(answer);
  const answerKey = [...answer].sort().join('|');
  let n = 0;
  for (const g of stemGroups(tiles, answer.length)) {
    if ([...g].sort().join('|') === answerKey) continue;
    if (hasBaseForm(g) === want) n += 1;
  }
  return n;
}

/** 라이벌 묶음 후보 — 대상과 같은 크기로 잘라낸 다른 어족의 형태들. */
function rivalSlice(other: Family, n: number, dropBase: boolean): string[] | null {
  const usable = dropBase ? other.forms.slice(1) : other.forms;
  if (usable.length < n) return null;
  return cohesive(usable.slice(0, n));
}

/** 어간이 안 붙은 묶음(불규칙 어족의 임의 조각)은 스캔 눈에 묶음으로 안 보인다 → 무용. */
function cohesive(slice: string[]): string[] | null {
  let shared = slice[0]?.length ?? 0;
  for (const f of slice) shared = Math.min(shared, commonPrefix(slice[0], f));
  return shared >= 3 ? slice : null;
}

/**
 * 어족 경계를 넘는 라이벌 묶음 — 서로 다른 어족의 실재어가 같은 어간을 공유하는 경우
 * (perception·perceptions·perceive·perceived·perceives). 5형태처럼 같은 크기의 어족을
 * 찾기 어려운 라운드에서 이쪽이 유일한 라이벌 공급원이다.
 */
function clusterRivals(forms: string[], n: number): string[][] {
  const out: string[][] = [];
  for (const L of [3, 4, 5]) {
    const g = new Map<string, string[]>();
    for (const f of forms) {
      if (f.length < L) continue;
      const k = f.slice(0, L);
      const arr = g.get(k);
      if (arr) arr.push(f);
      else g.set(k, [f]);
    }
    for (const arr of g.values()) {
      if (arr.length < n) continue;
      for (let t = 0; t < 3; t++) {
        const slice = cohesive(shuffleLocal(arr).slice(0, n));
        if (slice) out.push(slice);
      }
    }
  }
  return out;
}

export function buildRound(p: BuiltPool, fam: Family, solved: number, id: number): Round {
  const canDrop = fam.forms.length >= 3 && Math.random() < dropBaseChanceFor(solved);
  const dropped = canDrop ? fam.forms[0] : null;
  const answer = dropped ? fam.forms.filter((f) => f !== dropped) : [...fam.forms];

  const banned = new Set(fam.forms); // 뺀 원형도 보드에 두지 않는다(억울한 오답 차단)
  const seen = new Set(answer);
  const cands: Filler[] = [];
  let stemShared = 0;

  const admit = (form: string, scoped: boolean) => {
    if (!form || form.length < 2) return;
    if (banned.has(form) || seen.has(form)) return;
    if (isLikelyInflection(fam.lemma, form)) return; // 억울한 오답 차단
    const own = p.owners.get(form);
    if (own && own.has(fam.lemma)) return;
    if (form.startsWith(fam.lemma)) {
      // 대상 어간으로 시작하는 실재어는 소량만 — 접두 스캔에 잡음을 주되, 보드가
      // "대상 어간 천지"가 되어 사람 쪽 인지부하까지 올리지는 않게.
      if (stemShared >= MAX_STEM_SHARED || form.length < fam.lemma.length + 2) return;
      stemShared += 1;
    }
    seen.add(form);
    cands.push({ form, scoped });
  };

  // 라이벌 후보 수집 — 뜻이 겹치지 않고, 대상과 같은 크기의 어간 묶음을 낼 수 있는 어족.
  const rivalPool: string[][] = [];
  for (const other of p.families) {
    if (other.lemma === fam.lemma) continue;
    // 뜻이 포개지는 어족은 통째로 제외 — "보다"를 물었는데 watch 형태가 섞이면 불공정하다.
    if (koOverlaps(other.ko, fam.ko)) continue;
    for (const form of other.forms) admit(form, other.scoped);
    const slice = rivalSlice(other, answer.length, !!dropped);
    if (!slice) continue;
    if (slice.some((f) => banned.has(f) || isLikelyInflection(fam.lemma, f) || p.owners.get(f)?.has(fam.lemma))) continue;
    rivalPool.push(slice);
  }
  for (const f of p.fillers) admit(f.form, f.scoped);
  rivalPool.push(...clusterRivals(cands.map((c) => c.form), answer.length));

  // 2형태 라운드는 묶음이 짧아 우연히 겹칠 여지가 적다 → 라이벌을 2개 깔아 1/3 로 낮춘다.
  const wantRivals = answer.length <= 2 ? 2 : 1;

  const attempt = (rivals: string[][]): { tiles: string[]; rivals: number } => {
    const reserved = rivals.flat();
    const taken = new Set([...answer, ...reserved]);
    // 라이벌만큼 판을 키워 나머지 방해 타일 수는 유지한다(최소 3개는 남긴다).
    const size = Math.max(boardSizeFor(solved), answer.length + reserved.length + 3);
    const rest = cands.filter((c) => !taken.has(c.form));
    const need = Math.max(0, Math.min(size - answer.length - reserved.length, rest.length));

    let picked: Filler[];
    if (decoyBiasFor(solved)) {
      const scored = rest.map((c) => {
        let suf = 0;
        for (const a of answer) suf = Math.max(suf, commonSuffix(c.form, a));
        const sim = commonPrefix(c.form, fam.lemma) * 2 + Math.min(suf, 4);
        return { c, s: sim + (c.scoped ? 1.2 : 0) + Math.random() * 0.9 };
      });
      scored.sort((x, y) => y.s - x.s);
      const top = scored.slice(0, Math.max(need + 4, need * 3)).map((x) => x.c);
      picked = shuffleLocal(top).slice(0, need);
    } else {
      // 초반은 스코프 자료를 우선 노출(내 자료로 논다는 감각을 첫 판부터).
      const scoped = shuffleLocal(rest.filter((c) => c.scoped));
      const other = shuffleLocal(rest.filter((c) => !c.scoped));
      picked = [...scoped, ...other].slice(0, need);
    }

    const tiles = shuffleLocal([...answer, ...reserved, ...picked.map((c) => c.form)]);
    return { tiles, rivals: decoyGroupCount(tiles, answer) };
  };

  // 라이벌 조합을 몇 번 바꿔 보며 **봇의 탐지기로** 모호성을 확인한다.
  // 방해 타일이 우연히 묶음을 만들어 이미 모호하면 그대로 쓴다(판을 불필요하게 키우지 않게).
  let best = attempt([]);
  const shuffled = shuffleLocal(rivalPool);
  for (let a = 0; a < 6 && best.rivals < wantRivals && shuffled.length > 0; a++) {
    const pickList: string[][] = [];
    const used = new Set<string>();
    for (const slice of shuffleLocal(shuffled).slice(0, 12)) {
      if (pickList.length >= wantRivals) break;
      if (slice.some((f) => used.has(f))) continue;
      for (const f of slice) used.add(f);
      pickList.push(slice);
    }
    if (pickList.length === 0) break;
    const got = attempt(pickList);
    if (got.rivals > best.rivals) best = got;
  }

  return { id, fam, answer, dropped, tiles: best.tiles, rivals: best.rivals };
}

// ─── 문맥 힌트 ─────────────────────────────────────────────────────────────
/** 예문에서 해당 어족의 모든 형태를 가린다. 규칙 파생형까지 원형 접두로 한 번 더 훑는다. */
export function maskExample(example: string, fam: Family): string {
  let out = example;
  const forms = [...fam.forms].sort((a, b) => b.length - a.length);
  for (const f of forms) out = out.replace(new RegExp(`\\b${f}\\b`, 'gi'), '____');
  out = out.replace(new RegExp(`\\b${fam.lemma}[a-z]*\\b`, 'gi'), '____');
  return out;
}
