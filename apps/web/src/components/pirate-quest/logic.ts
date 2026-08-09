// apps/web/src/components/pirate-quest/logic.ts
// Pirate's Bounty v08 — "밀물 잠수(Tide Dive)" 규칙·상태 생성기.
//
// 왜 다시 썼나 (v07.8 감사 16/50):
//   이전 판은 카드가 한국어 뜻을 주고, 화면의 GLB 가 그 뜻을 그대로 조형한 모델이었다
//   (검 → Sword.glb). 영어를 한 글자도 모르는 사람이 100% 맞힐 수 있었고, 그 위에 얹은
//   콤보·시간보너스·힌트는 전부 난이도 0 인 과제 위의 장식이었다.
//
// 새 규칙 — 그림과 라벨의 결합을 끊고, 제출 시점에 정답을 화면에서 지운다:
//   ① 훑기(scan)  : 해변의 무작위 자리 k 곳에 **영단어 라벨**이 뜬다. 뜻은 없다.
//                   라벨이 붙는 오브젝트는 그 단어와 무관하다(나무통 위에 sword).
//   ② 회수(haul)  : 라벨이 물에 잠긴다(= 화면에서 사라진다). 그제서야 **한국어 뜻**이 불린다.
//                   그 뜻의 단어가 있던 자리를 클릭한다.
//   ③ 확정(bank)  : 언제든 확정해 미확정 점수를 배로 챙길 수 있다.
//                   한 번 더 캐면 배수가 오르지만, 틀리는 순간 이번 잠수의 미확정분은 전부 잃는다.
//
// 인출 규칙 점검:
//   · 제출 전 화면에 정답을 특정할 정보가 없다(라벨은 잠겨 있고 오브젝트는 무관하다).
//   · 영단어와 한국어 뜻이 동시에 화면에 있는 순간이 없다(①은 영어만, ②는 한국어만).
//   · 부분 정답 개수 같은 무위험 탐색 오라클이 없다 — 클릭 한 번이 곧 판돈 전부다.
//   · 정답 공개는 제출 후에만, 대신 그때는 고른 것과 정답을 둘 다 충분히 보여준다.

import { clamp, shuffle, type Word } from '@/components/game/_shared/gamekit';
import { ITEM_SLOTS, PIRATE_WORDS } from '@/lib/pirate-quest/data';

export type Phase = 'loading' | 'scan' | 'haul' | 'choice' | 'reveal' | 'settle' | 'done';

/** 해변에 고정 배치되는 장식 오브젝트 한 개. 단어와 아무 관계가 없다. */
export interface SceneryPlacement {
  /** ITEM_SLOTS 인덱스 */
  slot: number;
  modelUrl: string;
  /** 이 GLB 가 원래 무엇인지 — 라벨이 자기 자신 위에 붙는 누설만 막는 데 쓴다. */
  subject: string;
  scale: number;
  x: number;
  z: number;
}

export interface Marker {
  /** 키보드 1~6 · 화면 배지. 왼쪽 위 → 오른쪽 아래 읽기 순서. */
  badge: number;
  slot: number;
  word: Word;
  hauled: boolean;
}

export interface Dive {
  /** 1-based 잠수 회차 */
  index: number;
  markers: Marker[];
  /**
   * 아직 안 불릴 badge (셔플됨). 길이는 항상 markers.length - 1 이다 —
   * 마지막 한 자리까지 물으면 소거법으로 답이 확정돼(선택지 1개) 영어를 몰라도 맞는다.
   * 그런 정답이 onCorrect 로 올라가면 FSRS 에 거짓 인출 신호가 남는다.
   */
  queue: number[];
  /** 지금 묻고 있는 badge */
  asking: number | null;
  scanMs: number;
  /** 이번 잠수에서 등불을 썼는가 (점수 ×0.5 · FSRS 미기록) */
  lantern: boolean;
  /** 미확정 점수 — 틀리면 전부 잃는다 */
  pending: number;
  /** 이번 잠수에서 회수한 개수 */
  hauled: number;
}

export const PQ = {
  /** 세션 시간은행. 2~4분 세션을 위해 100초 + 확정 보상으로 연장. */
  TIDE_MS: 100_000,
  WARN_MS: 15_000,
  /** 회수 1개 기본 점수 */
  BASE: 100,
  /** 연쇄 배수 — 한 잠수에서 몇 번째 회수인가 */
  CHAIN: [1, 1.6, 2.4, 3.5, 5, 7] as const,
  /** 확정 시 회수 1개당 되찾는 시간 */
  BANK_MS_PER_ITEM: 2_500,
  /** 잠수의 라벨을 전부 회수하면 붙는 배수 */
  FULL_HAUL: 1.5,
  WRONG_DRAIN_MS: 6_000,
  LANTERN_DRAIN_MS: 4_000,
  LANTERN_MS: 900,
  LANTERN_MULT: 0.5,
  MIN_K: 3,
  MAX_K: 6,
  /** 오답 교정 자동 넘김 (아무 키·클릭으로 즉시 넘길 수 있다) */
  REVEAL_MS: 1_800,
  /** 확정 정산 표시 */
  SETTLE_MS: 640,
  /** 앞줄(z ≥ 1.7) 슬롯은 하단 카드에 가려질 수 있어 마커 대상에서 뺀다. */
  MARKER_SLOT_FROM: 6,
} as const;

/** 세션이 깊어질수록 한 번에 외워야 하는 라벨이 늘어난다. */
export function markerCount(bankedItems: number): number {
  return clamp(PQ.MIN_K + Math.floor(bankedItems / 4), PQ.MIN_K, PQ.MAX_K);
}

/** 회차가 갈수록 라벨 1개당 주어지는 노출 시간이 줄어든다. */
export function perWordMs(diveIndex: number): number {
  return clamp(880 - 30 * (diveIndex - 1), 420, 880);
}

export function scanDurationMs(diveIndex: number, k: number): number {
  return Math.max(1_600, k * perWordMs(diveIndex));
}

/** 0(초반 황금빛) → 1(해가 지고 안개가 조인다). 씬 그레이딩용. */
export function depthFrac(diveIndex: number): number {
  return clamp((diveIndex - 1) / 11, 0, 1);
}

/** i 번째 회수의 연쇄 배수 (0-based) */
export function chainMult(i: number): number {
  return PQ.CHAIN[Math.min(i, PQ.CHAIN.length - 1)];
}

export function haulPoints(i: number): number {
  return Math.round(PQ.BASE * chainMult(i));
}

/** 확정 시 실제로 통장에 들어가는 점수. 물을 수 있는 자리를 다 캐면 완전 회수 배수. */
export function bankValue(dive: Dive, comboMult: number): number {
  const full = dive.hauled > 0 && dive.queue.length === 0 ? PQ.FULL_HAUL : 1;
  const lantern = dive.lantern ? PQ.LANTERN_MULT : 1;
  return Math.round(dive.pending * full * lantern * comboMult);
}

/** 내장 뱅크 — 학습자 단어 스코프가 없을 때 쓰는 해적 테마 어휘. */
export const BANK_WORDS: Word[] = PIRATE_WORDS.map((w) => ({
  en: w.en,
  ko: w.ko,
  pron: w.pron,
}));

/** 해변 장식 배치 — 매 세션 다른 조합. 단어 풀과 완전히 독립. */
export function buildScenery(): SceneryPlacement[] {
  const picks = shuffle(PIRATE_WORDS).slice(0, ITEM_SLOTS.length);
  return picks.map((w, i) => ({
    slot: i,
    modelUrl: w.modelUrl,
    subject: w.en,
    scale: w.scale ?? 1.0,
    x: ITEM_SLOTS[i].x,
    z: ITEM_SLOTS[i].z,
  }));
}

function sameWord(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * 다음 잠수를 만든다.
 *  - forced: 이번 세션에서 놓친 단어(missQueue). 반드시 다시 나온다.
 *  - recent: 최근에 쓴 단어 — 풀이 충분하면 피한다.
 *  - 라벨은 "그 단어를 조형한 오브젝트"에 절대 붙이지 않는다(누설 차단).
 */
export function buildDive({
  index,
  pool,
  scenery,
  k,
  forced,
  recent,
}: {
  index: number;
  pool: Word[];
  scenery: SceneryPlacement[];
  k: number;
  forced: Word[];
  recent: Set<string>;
}): Dive {
  const chosen: Word[] = [];
  const taken = new Set<string>();
  const push = (w: Word) => {
    const key = w.en.toLowerCase();
    if (taken.has(key)) return;
    taken.add(key);
    chosen.push(w);
  };

  forced.slice(0, Math.max(1, Math.floor(k / 2))).forEach(push);

  const fresh = shuffle(pool.filter((w) => !recent.has(w.en.toLowerCase())));
  for (const w of fresh) {
    if (chosen.length >= k) break;
    push(w);
  }
  if (chosen.length < k) {
    for (const w of shuffle(pool)) {
      if (chosen.length >= k) break;
      push(w);
    }
  }

  // 슬롯 배정 — 앞줄 제외 + 자기 자신 모델 위 금지.
  const freeSlots = shuffle(
    scenery.filter((s) => s.slot >= PQ.MARKER_SLOT_FROM).map((s) => s.slot),
  );
  const subjectBySlot = new Map(scenery.map((s) => [s.slot, s.subject]));
  const assigned: { word: Word; slot: number }[] = [];

  for (const word of chosen) {
    if (freeSlots.length === 0) break;
    let pickAt = freeSlots.findIndex((slot) => !sameWord(subjectBySlot.get(slot) ?? '', word.en));
    if (pickAt < 0) pickAt = 0;
    const [slot] = freeSlots.splice(pickAt, 1);
    assigned.push({ word, slot });
  }

  // 배지는 화면 읽기 순서(먼 곳 → 가까운 곳, 왼쪽 → 오른쪽)로 매긴다.
  const posBySlot = new Map(scenery.map((s) => [s.slot, s]));
  assigned.sort((a, b) => {
    const pa = posBySlot.get(a.slot);
    const pb = posBySlot.get(b.slot);
    if (!pa || !pb) return 0;
    if (Math.abs(pa.z - pb.z) > 0.35) return pa.z - pb.z;
    return pa.x - pb.x;
  });

  const markers: Marker[] = assigned.map((a, i) => ({
    badge: i + 1,
    slot: a.slot,
    word: a.word,
    hauled: false,
  }));

  return {
    index,
    markers,
    // 마지막 한 자리는 절대 묻지 않는다 — 선택지가 1개로 줄면 그건 인출이 아니라 소거법이다.
    queue: shuffle(markers.map((m) => m.badge)).slice(0, Math.max(1, markers.length - 1)),
    asking: null,
    scanMs: scanDurationMs(index, markers.length),
    lantern: false,
    pending: 0,
    hauled: 0,
  };
}
