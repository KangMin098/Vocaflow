// apps/web/src/components/pirate-quest/logic.ts
// Pirate's Bounty v08.2 — "밀물 잠수(Tide Dive)" 규칙·상태 생성기.
//
// 규칙 요약 — 그림과 라벨의 결합을 끊고, 제출 시점에 정답을 화면에서 지운다:
//   ① 훑기(scan)  : 해변의 무작위 자리 k 곳에 **영단어 라벨**이 뜬다. 뜻은 없다.
//                   라벨이 붙는 오브젝트는 그 단어와 무관하다(나무통 위에 sword).
//   ② 회수(haul)  : 라벨이 물에 잠긴다(= 화면에서 사라진다). 그제서야 **한국어 뜻**이 불린다.
//                   그 뜻의 단어가 있던 자리를 클릭한다.
//   ③ 확정(bank)  : 언제든 확정해 미확정 점수를 챙길 수 있다.
//                   한 번 더 캐면 연쇄 배수가 오르지만, 틀리는 순간 미확정분은 전부 잃는다.
//
// ── 3라운드(적대적 반증) 수정 ────────────────────────────────────────────
// [익스플로짓 1] "모든 잠수의 마지막 회수는 강제 2지선다이고 그게 ×1.5 를 켠다"
//   두 갈래로 막았다.
//   (a) 완전 회수 보상을 **점수 배수에서 밀물 시간으로 옮겼다**(FULL_HAUL_MS).
//       배수 ×1.5 는 마지막 밀어붙이기의 손익분기 성공확률을 0.588 → 0.42 로 끌어내려,
//       "동전던지기가 확정보다 이득"인 구간을 만들고 있었다. 배수를 걷어내면
//       손익분기가 회수를 거듭할수록 단조 증가한다(0.385 → 0.52 → 0.588).
//       ※ 검증(시뮬): 점수만 볼 때 추측이 +EV 인 결정 지점 3/6 → 1/6,
//         오답 −6초·확정 +2.5초/개를 35점/초로 환산해 넣으면 0/6.
//   (b) 회수한 자리도 haul 동안 **물에 잠긴 것과 똑같이 보이고, 여전히 누를 수 있다**
//       (누르면 정상 오답). 화면이 후보를 지워주지 않는다.
//   (c) 그래도 "자기가 누른 자리"를 기억하는 플레이어에게는 마지막 질문의 정보상 후보가
//       2개다. 그 정답은 인출 증거로 쓸 수 없으므로 ASSIST_OPEN_MAX 이하이면
//       결과를 assisted 로 올린다(FSRS 카드 미갱신).
//
// [익스플로짓 2] "390px 에서 라벨이 서로 겹쳐 훑기 자체가 불가능"
//   beachMetrics + layoutMarkers 가 **실제 카메라 투영 좌표와 실제 라벨 픽셀 폭**으로
//   사각형 충돌을 풀어 자리를 고른다. 겹치면 세로 계단(liftPx)으로 올린다.
//   ※ 검증(시뮬 4만 회/뷰포트): 390×844 에서 읽을 수 없는 잠수 비율 100% → 0.00%.
//
// [익스플로짓 5(브리프 항목 #5 후속)] missQueue 강제 단어가 1/k 확률로 증발하던 문제
//   묻지 않을 자리 하나를 뽑을 때 **강제 재출제 단어는 후보에서 제외**한다.
//
// 인출 규칙 점검:
//   · 제출 전 화면에 정답을 특정할 정보가 없다(라벨은 잠겨 있고 오브젝트는 무관하다).
//   · 영단어와 한국어 뜻이 동시에 화면에 있는 순간이 없다 — 회수한 자리도 뜻을 안 띄운다.
//   · 부분 정답 개수 같은 무위험 탐색 오라클이 없다 — 클릭 한 번이 곧 판돈 전부다.
//   · 정답 공개는 제출 후에만, 대신 그때는 고른 것과 정답을 둘 다 충분히 보여준다.

import { clamp, shuffle, type Word } from '@/components/game/_shared/gamekit';
import { ITEM_SLOTS, PIRATE_WORDS } from '@/lib/pirate-quest/data';

export type Phase =
  | 'loading'
  | 'scan'
  | 'haul'
  | 'choice'
  /** 오답 뒤 "뜻은 알았나" 마이크로 체크 — 위치 실패와 어휘 실패를 가른다 */
  | 'recall'
  | 'reveal'
  | 'settle'
  | 'done';

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
  /** 키보드 1~5 · 화면 배지. 왼쪽 위 → 오른쪽 아래 읽기 순서. */
  badge: number;
  slot: number;
  word: Word;
  hauled: boolean;
  /**
   * 화면 세로 계단(px). 3D 좌표는 그대로 두고 CSS 로만 끌어올린다 —
   * 카메라가 거의 수평이라 z 가 달라도 라벨이 같은 높이에 겹쳐 찍히기 때문이다.
   */
  liftPx: number;
}

export interface Dive {
  /** 1-based 잠수 회차 */
  index: number;
  markers: Marker[];
  /**
   * 아직 안 불릴 badge (셔플됨). 길이는 항상 markers.length - 1 이다 —
   * 마지막 한 자리까지 물으면 소거법으로 답이 확정돼(선택지 1개) 영어를 몰라도 맞는다.
   */
  queue: number[];
  /** 지금 묻고 있는 badge */
  asking: number | null;
  scanMs: number;
  /** 이번 잠수에서 등불을 썼는가 (점수 ×0.5 · 밀물 환급 0 · FSRS assisted) */
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
  /**
   * gamekit useCountdown 의 가산 상한 비율(0.75)을 그대로 복제한다.
   * 훅이 상한을 조용히 먹어치우는 바람에 정산 카드가 "밀물 +12초"라고 거짓말하고 있었다.
   * 훅 시그니처는 공용 자산이라 못 바꾸므로, 게임 쪽에서 같은 식으로 계산해
   * **실제로 늘어난 시간만** 표시한다.
   */
  EXTEND_CAP_RATIO: 0.75,
  /** 회수 1개 기본 점수 */
  BASE: 100,
  /** 연쇄 배수 — 한 잠수에서 몇 번째 회수인가 */
  CHAIN: [1, 1.6, 2.4, 3.5, 5] as const,
  /** 확정 시 회수 1개당 되찾는 시간 */
  BANK_MS_PER_ITEM: 2_500,
  /**
   * 물을 수 있는 자리를 다 캤을 때의 보상. **점수 배수가 아니라 밀물 시간**이다.
   * 점수 배수(구 1.5)는 마지막 회수의 판돈을 부풀려 순수 운의 밀어붙이기를 +EV 로
   * 만들었다. 시간 보상은 미확정 점수와 곱해지지 않아 그 왜곡이 없다.
   */
  FULL_HAUL_MS: 2_500,
  WRONG_DRAIN_MS: 6_000,
  LANTERN_DRAIN_MS: 4_000,
  LANTERN_MS: 900,
  LANTERN_MULT: 0.5,
  /**
   * 세션당 등불 개수. 무제한이던 시절 "스캔 즉시 종료 → 등불 → 전량 회수" 루프가
   * 잠수당 시간 순증 +8.5초로 무한히 돌면서 점수·콤보만 쌓고 학습 신호는 0 이었다.
   * 개수 제한 + 밀물 환급 0 으로 루프의 시간 수지를 잠수당 −4초로 뒤집는다.
   */
  LANTERN_MAX: 2,
  MIN_K: 3,
  /**
   * 4항목(Sweller 작업기억) + 1. 구 6은 420ms 노출과 겹쳐 대상 학습자에게
   * 구조적으로 불가능한 과제였고, 그 실패가 전부 어휘 오답으로 FSRS 에 쌓였다.
   */
  MAX_K: 5,
  /**
   * 남은 후보(= 회수 안 된 자리)가 이 수 이하면 소거법 사정권이다.
   * 그 정답·오답은 인출 증거로 쓰지 않는다(assisted).
   */
  ASSIST_OPEN_MAX: 2,
  /** 오답 뒤 "뜻은 알았나" 3지선다 제한 시간. 무응답 = 모름 = 오답 보고. */
  RECALL_MS: 4_000,
  /** 오답 교정 자동 넘김 (아무 키·클릭으로 즉시 넘길 수 있다) */
  REVEAL_MS: 1_800,
  /** 확정 정산 표시 */
  SETTLE_MS: 640,
  /** 앞줄(z ≥ 1.7) 슬롯은 하단 카드에 가려질 수 있어 마커 대상에서 뺀다. */
  MARKER_SLOT_FROM: 6,
} as const;

/** 세션이 깊어질수록 한 번에 외워야 하는 라벨이 늘어난다. */
export function markerCount(bankedItems: number, maxK: number): number {
  // 구 /4 는 확정 4개(≈ 잠수 2회)만에 최대치에 닿아 램프가 사실상 없었다.
  return clamp(PQ.MIN_K + Math.floor(bankedItems / 6), PQ.MIN_K, Math.max(PQ.MIN_K, maxK));
}

/**
 * 회차가 갈수록 라벨 1개당 주어지는 노출 시간이 줄어든다.
 * 하한 560ms — 구 420ms 는 k=5 를 2.1초에 외우라는 요구여서 위치 망각이 확정이었다.
 * (실패가 어휘 오답으로 기록되던 경로라 하한을 올리는 것이 공정성 수정이다.)
 */
export function perWordMs(diveIndex: number): number {
  return clamp(880 - 30 * (diveIndex - 1), 560, 880);
}

export function scanDurationMs(diveIndex: number, k: number): number {
  return Math.max(1_800, k * perWordMs(diveIndex));
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

/**
 * 확정 시 실제로 통장에 들어가는 점수.
 * 완전 회수 배수는 없다 — 그 보상은 PQ.FULL_HAUL_MS(밀물)로 나간다.
 */
export function bankValue(dive: Dive, comboMult: number): number {
  const lantern = dive.lantern ? PQ.LANTERN_MULT : 1;
  return Math.round(dive.pending * lantern * comboMult);
}

/** 이번 질문에서 플레이어가 소거로도 지울 수 없는 자리 수. */
export function openCandidates(dive: Dive): number {
  return Math.max(1, dive.markers.length - dive.hauled);
}

/** 이 회수는 소거법 사정권인가 — 결과를 FSRS 에 인출로 올리지 않는다. */
export function isNarrowChoice(dive: Dive): boolean {
  return openCandidates(dive) <= PQ.ASSIST_OPEN_MAX;
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

// ── 화면 계측 ─────────────────────────────────────────────────────────────
//
// 반증자가 산수로 증명한 것: 390×844 에서 카메라는 z≈44 까지 물러나 1 월드유닛이
// 27.9px 이 되는데, 라벨은 130px 급이라 슬롯 간격 2유닛(≈56px)으로는 겹칠 수밖에 없다.
// 게다가 카메라 피치가 약 7°뿐이라 **z 가 달라도 화면 세로 위치가 거의 같다**
// (z −3 ↔ +1 의 화면 차이가 390px 폰에서 15px 남짓). 즉 "뒷줄이니까 위에 그려지겠지"는
// 성립하지 않는다. 그래서 자리 선택을 실제 투영 좌표 + 실제 라벨 픽셀로 푼다.

const CAM_FOV_DEG = 38;
const CAM_TAN = Math.tan((CAM_FOV_DEG * Math.PI) / 360);
const CAM_EYE_Y = 5.5;
const CAM_LOOK_Y = 1.3;
const CAM_TARGET_HEIGHT = 11;
/** 마커 Html 이 붙는 대략적인 월드 높이 (PirateModel 의 TARGET_HEIGHT*scale + 0.45). */
const MARKER_WORLD_Y = 1.55;

export interface BeachMetrics {
  /** 카메라가 화면 가로에 맞추려는 월드 폭 */
  targetWidth: number;
  /** 카메라 z */
  camZ: number;
  /** 화면 폭이 좁아 라벨 자체를 줄여야 하는가 (CSS max-width:430px 와 같은 기준) */
  narrow: boolean;
  /** 세로가 짧아 계단을 못 쌓는가 */
  short: boolean;
  /** 이 화면에서 겹치지 않게 놓을 수 있는 라벨 수 상한 */
  maxK: number;
  /** 세로 계단 수 */
  tiers: number;
  /** 계단 한 칸 픽셀 */
  liftStepPx: number;
  width: number;
  height: number;
  /** HUD 가 차지하는 위쪽 픽셀 */
  topGuardPx: number;
  /** 조타실 카드가 차지하는 아래쪽 픽셀 */
  bottomGuardPx: number;
  labelMaxPx: number;
  labelChromePx: number;
  labelCharPx: number;
  labelMaxCh: number;
  /** 월드 (x, z) → 화면 중앙 기준 픽셀 */
  project: (x: number, z: number) => { px: number; py: number };
}

export function beachMetrics(width: number, height: number): BeachMetrics {
  const w = Math.max(240, width);
  const h = Math.max(320, height);
  const aspect = w / h;
  const narrow = w <= 430; // PirateQuestUI.css 의 라벨 축소 미디어쿼리와 같은 경계
  const short = h < 520;

  // 세로로 긴 화면에서 targetWidth 14 를 고집하면 카메라가 너무 물러나 라벨이 상대적으로
  // 거대해진다. 좁은 화면일수록 월드를 좁게 잡아 1유닛당 픽셀을 올린다.
  const targetWidth = narrow ? 11 : aspect < 1.0 ? 13 : 14;
  const camZ = Math.max(
    CAM_TARGET_HEIGHT / 2 / CAM_TAN,
    targetWidth / 2 / CAM_TAN / Math.max(aspect, 0.1),
  );

  // 카메라 기저 (x 성분 0 — 카메라는 x=0 에서 정면을 본다)
  const dy = CAM_LOOK_Y - CAM_EYE_Y;
  const dz = -camZ;
  const len = Math.hypot(dy, dz) || 1;
  const fy = dy / len;
  const fz = dz / len;
  const uy = -fz;
  const uz = fy;

  const project = (x: number, z: number) => {
    const ry = MARKER_WORLD_Y - CAM_EYE_Y;
    const rz = z - camZ;
    const depth = ry * fy + rz * fz || 0.001;
    return {
      px: ((x / depth / (CAM_TAN * aspect)) * w) / 2,
      py: (-((ry * uy + rz * uz) / depth / CAM_TAN) * h) / 2,
    };
  };

  return {
    targetWidth,
    camZ,
    narrow,
    short,
    maxK: short ? 3 : narrow ? 4 : PQ.MAX_K,
    tiers: short ? 1 : 3,
    liftStepPx: short ? 0 : clamp(Math.round(h * 0.08), 60, 72),
    width: w,
    height: h,
    // HUD(좁은 화면은 밀물 시계가 둘째 줄로 내려가 두 줄) / 조타실 카드가 가리는 띠.
    // 마커가 이 안에 들어가면 라벨을 읽을 수 없으므로 자리 후보에서 뺀다.
    topGuardPx: w >= 768 ? 76 : 110,
    bottomGuardPx: Math.min(264, h * 0.46),
    labelMaxPx: narrow ? 118 : 152,
    labelChromePx: narrow ? 41 : 50, // padding + gap + 배지
    labelCharPx: narrow ? 7.0 : 8.2,
    labelMaxCh: narrow ? 11 : 14,
    project,
  };
}

function labelWidthPx(word: string, m: BeachMetrics): number {
  return Math.min(m.labelMaxPx, m.labelChromePx + word.length * m.labelCharPx);
}

function labelHeightPx(word: string, m: BeachMetrics): number {
  // max-width 를 넘으면 2줄로 접힌다(-webkit-line-clamp: 2). 보수적으로 잡는다.
  return word.length > m.labelMaxCh ? 58 : 44;
}

interface Placed {
  slot: number;
  tier: number;
  px: number;
  cy: number;
  wpx: number;
  hpx: number;
}

/**
 * 단어들을 겹치지 않는 자리 + 계단에 배치한다.
 * 무작위 재시작 그리디 — 48회 안에 완전해를 못 찾으면 가장 많이 채운 배치에
 * 남은 것을 얹는다(빈 라벨보다는 낫다). 실측 시뮬에서 완화 경로 발생률은 0.00% 였다.
 */
function layoutMarkers(
  words: Word[],
  slots: { slot: number; x: number; z: number }[],
  m: BeachMetrics,
  forbidden: (slot: number, word: Word) => boolean,
): Placed[] {
  const GAP = 8;
  const edge = m.width / 2 - 6;

  let best: Placed[] = [];
  for (let attempt = 0; attempt < 48; attempt++) {
    const order = shuffle(slots);
    const placed: Placed[] = [];
    for (const word of words) {
      const wpx = labelWidthPx(word.en, m);
      const hpx = labelHeightPx(word.en, m);
      let found: Placed | null = null;
      for (const s of order) {
        if (placed.some((p) => p.slot === s.slot)) continue;
        if (forbidden(s.slot, word)) continue;
        const pr = m.project(s.x, s.z);
        if (pr.px - wpx / 2 < -edge || pr.px + wpx / 2 > edge) continue;
        for (let tier = 0; tier < m.tiers; tier++) {
          const cy = pr.py - tier * m.liftStepPx;
          if (cy - hpx / 2 < -m.height / 2 + m.topGuardPx) continue;
          if (cy + hpx / 2 > m.height / 2 - m.bottomGuardPx) continue;
          const clash = placed.some(
            (p) =>
              Math.abs(p.px - pr.px) < (p.wpx + wpx) / 2 + GAP &&
              Math.abs(p.cy - cy) < (p.hpx + hpx) / 2 + GAP,
          );
          if (!clash) {
            found = { slot: s.slot, tier, px: pr.px, cy, wpx, hpx };
            break;
          }
        }
        if (found) break;
      }
      if (!found) break;
      placed.push(found);
    }
    if (placed.length === words.length) return placed;
    if (placed.length > best.length) best = placed;
  }

  const order = shuffle(slots);
  const placed = best.slice();
  for (let i = placed.length; i < words.length; i++) {
    const free = order.filter((c) => !placed.some((p) => p.slot === c.slot));
    // 완화 경로에서도 "자기 모델 위에 자기 라벨" 누설만은 끝까지 지킨다.
    const s = free.find((c) => !forbidden(c.slot, words[i])) ?? free[0] ?? order[0];
    if (!s) break;
    const pr = m.project(s.x, s.z);
    const tier = i % Math.max(1, m.tiers);
    placed.push({
      slot: s.slot,
      tier,
      px: pr.px,
      cy: pr.py - tier * m.liftStepPx,
      wpx: labelWidthPx(words[i].en, m),
      hpx: labelHeightPx(words[i].en, m),
    });
  }
  return placed;
}

function sameWord(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * 다음 잠수를 만든다.
 *  - forced: 이번 세션에서 놓친 단어(missQueue). 반드시 다시 나오고, **반드시 불린다**.
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
  metrics,
}: {
  index: number;
  pool: Word[];
  scenery: SceneryPlacement[];
  k: number;
  forced: Word[];
  recent: Set<string>;
  metrics: BeachMetrics;
}): Dive {
  const chosen: Word[] = [];
  const taken = new Set<string>();
  const push = (w: Word) => {
    const key = w.en.toLowerCase();
    if (taken.has(key)) return;
    taken.add(key);
    chosen.push(w);
  };

  const forcedKeys = new Set<string>();
  forced.slice(0, Math.max(1, Math.floor(k / 2))).forEach((w) => {
    forcedKeys.add(w.en.toLowerCase());
    push(w);
  });

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

  // 슬롯 후보 — 앞줄 제외. 자기 자신 모델 위 금지는 배치기에 제약으로 넘긴다.
  const slots = scenery
    .filter((s) => s.slot >= PQ.MARKER_SLOT_FROM)
    .map((s) => ({ slot: s.slot, x: s.x, z: s.z }));
  const subjectBySlot = new Map(scenery.map((s) => [s.slot, s.subject]));

  const placed = layoutMarkers(chosen, slots, metrics, (slot, word) =>
    sameWord(subjectBySlot.get(slot) ?? '', word.en),
  );

  const assigned = placed.map((p, i) => ({ word: chosen[i], placed: p }));

  // 배지는 화면 읽기 순서(위 → 아래, 왼쪽 → 오른쪽)로 매긴다.
  assigned.sort((a, b) => {
    if (Math.abs(a.placed.cy - b.placed.cy) > 24) return a.placed.cy - b.placed.cy;
    return a.placed.px - b.placed.px;
  });

  const markers: Marker[] = assigned.map((a, i) => ({
    badge: i + 1,
    slot: a.placed.slot,
    word: a.word,
    hauled: false,
    liftPx: a.placed.tier * metrics.liftStepPx,
  }));

  // 묻지 않을 자리 하나 — 강제 재출제(missQueue) 단어는 후보에서 제외한다.
  // 예전에는 무작위로 빼는 바람에 k=3 이면 33% 확률로 "반드시 다시 나온다"던 단어가
  // missQueue 에서만 지워지고 한 번도 안 불린 채 사라졌다.
  const droppable = markers.filter((m) => !forcedKeys.has(m.word.en.toLowerCase()));
  const dropPool = droppable.length > 0 ? droppable : markers;
  const dropBadge = markers.length > 1 ? shuffle(dropPool)[0].badge : -1;

  return {
    index,
    markers,
    queue: shuffle(markers.filter((m) => m.badge !== dropBadge).map((m) => m.badge)),
    asking: null,
    scanMs: scanDurationMs(index, markers.length),
    lantern: false,
    pending: 0,
    hauled: 0,
  };
}

/**
 * 오답 뒤 마이크로 체크 보기 — 정답 뜻 + 같은 잠수의 다른 뜻 2개.
 * 3지선다여서 순수 추측 통과율이 33% 다(2지선다 50% 대비 위양성 절반).
 */
export function recallOptions(dive: Dive, target: Word): string[] {
  const seen = new Set([target.ko.trim()]);
  const others: string[] = [];
  for (const m of shuffle(dive.markers)) {
    const ko = m.word.ko.trim();
    if (seen.has(ko)) continue;
    seen.add(ko);
    others.push(ko);
    if (others.length >= 2) break;
  }
  return shuffle([target.ko.trim(), ...others]);
}
