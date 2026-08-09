// apps/web/src/components/game/morphmerge/morph-bank.ts
// Morphmerge 데이터·라운드 생성 — 순수 로직(컴포넌트 없음).
//
// 여기서 지키는 두 가지 원칙:
//   1) 학습자 자료 우선. wordPool 에서 어족(원형+굴절형)을 만들고, 굴절형이 없는
//      스코프 단어도 버리지 않고 **방해 타일**로 판에 올린다. 내장 뱅크는 스코프
//      어족이 4개 미만일 때만 보충으로 섞인다(그때도 스코프 어족을 2배 가중).
//   2) 정답 누출 차단. 방해 타일은 (a) 대상 어족의 어떤 형태도 아니고 (b) 대상 원형으로
//      시작하지 않으며 (c) 다른 어족이라도 대상과 뜻이 겹치면 제외한다.
//      "미등재 규칙형"(예: 사전에 없는 goes)을 오답으로 몰아 억울하게 만들지 않기 위한 장치.

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

/** 스코프 어족이 이 수 이상이면 내장 뱅크를 아예 섞지 않는다. */
export const SCOPE_ONLY_MIN = 4;

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
  const bankUsable = BANK_FAMILIES.filter((f) => !takenLemma.has(f.lemma));
  const families = scopeOnly ? scopeFamilies : [...scopeFamilies, ...bankUsable];

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
 * 가방(bag). 뱅크가 섞인 판에서만 스코프 어족을 2배로 넣어 **학습자 자료가 먼저·자주**
 * 나오게 한다(스코프만으로 도는 판은 이미 전부 학습자 자료라 가중이 무의미).
 * 같은 어족이 바로 다음 판에 또 나오지 않게 인접 중복도 한 번 훑어 흩는다 —
 * 같은 단어로 onWrong 이 도배되는 것을 막는 장치이기도 하다.
 */
export function refillBag(families: Family[], prevLemma: string | null): Family[] {
  const hasBank = families.some((f) => !f.scoped);
  const bag = shuffleLocal(hasBank ? [...families, ...families.filter((f) => f.scoped)] : families);

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

export function buildRound(p: BuiltPool, fam: Family, solved: number, id: number): Round {
  const canDrop = fam.forms.length >= 3 && Math.random() < dropBaseChanceFor(solved);
  const dropped = canDrop ? fam.forms[0] : null;
  const answer = dropped ? fam.forms.filter((f) => f !== dropped) : [...fam.forms];

  const banned = new Set(fam.forms); // 뺀 원형도 보드에 두지 않는다(억울한 오답 차단)
  const seen = new Set(answer);
  const cands: Filler[] = [];

  const admit = (form: string, scoped: boolean) => {
    if (!form || form.length < 2) return;
    if (banned.has(form) || seen.has(form)) return;
    if (form.startsWith(fam.lemma)) return; // 사전에 없는 규칙형까지 방어
    const own = p.owners.get(form);
    if (own && own.has(fam.lemma)) return;
    seen.add(form);
    cands.push({ form, scoped });
  };

  for (const other of p.families) {
    if (other.lemma === fam.lemma) continue;
    // 뜻이 포개지는 어족은 통째로 제외 — "보다"를 물었는데 watch 형태가 섞이면 불공정하다.
    if (other.ko === fam.ko || other.ko.includes(fam.ko) || fam.ko.includes(other.ko)) continue;
    for (const form of other.forms) admit(form, other.scoped);
  }
  for (const f of p.fillers) admit(f.form, f.scoped);

  const size = Math.max(boardSizeFor(solved), answer.length + 4);
  const need = Math.max(0, Math.min(size - answer.length, cands.length));

  let picked: Filler[];
  if (decoyBiasFor(solved)) {
    const scored = cands.map((c) => {
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
    const scoped = shuffleLocal(cands.filter((c) => c.scoped));
    const rest = shuffleLocal(cands.filter((c) => !c.scoped));
    picked = [...scoped, ...rest].slice(0, need);
  }

  return {
    id,
    fam,
    answer,
    dropped,
    tiles: shuffleLocal([...answer, ...picked.map((c) => c.form)]),
  };
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
