// apps/web/src/components/game/wordblitz/WordBlitzGame.tsx
// WordBlitz — 연사(Rapid Fire). v08 전면 재설계.
//
// ── 계열 안에서 무엇으로 구분되는가 ──────────────────────────────────────
// blitz 계열 4종은 같은 인출(뜻→단어)을 공유하되 동기 장치가 달라야 한다.
//   daily-blitz  = 세션 시계를 화폐로 쓰는 데일리 의식(선불 베팅)
//   word-economy = 코인 경제와 상점 투자
//   ghost-race   = 내 최고기록 유령과의 비동기 경주
//   wordblitz    = **생존형 가속** — 시계가 없다. 목숨 3개로 어디까지 버티는가.
//
// wordblitz 에만 있는 결정: **조임 카드**. 5발(문항)을 클리어할 때마다 게임이
// 두 장을 내밀고 학습자가 "어느 방향으로 어려워질지"를 고른다. 가속이냐 혼선이냐
// 역방향이냐 잔상이냐 — 고른 카드는 그 판 내내 남고 점수 배수를 키운다.
// 다치면 '정비'(목숨 +1)가 위험 카드와 나란히 나오므로 안전과 욕심이 둘 다 합리적이다.
// → 같은 4지선다인데 판마다 빌드가 달라지고, 난이도를 스스로 정했으므로 불공정하지 않다.
//
// ── 이전 판(v07.2)에서 고친 것 ──────────────────────────────────────────
//  1) 톱니 제거 — 창(문항 제한시간)이 combo 파생이라 오답 1회에 5000ms 로 리셋됐다.
//     이제 창은 누적 진행(단계·발수)과 내가 고른 카드로만 좁아진다. 단조 감소.
//  2) 결정 0개 → 단계마다 조임 카드 1택. 콤보에는 목숨이라는 판돈이 붙었다.
//  3) 45초 세션 → 최대 8단계 × 5발(40문항) + 목숨 3. 실측 체감 2~4분.
//  4) 오답이 0.68초 스쳐가던 문제 → 오답 리빌 1.7초 + 정답 카드(뜻·발음·예문) +
//     TTS(정답/오답 양쪽, 음소거 시 침묵) + **세션 내 재출제 큐**(다시 만난 단어).
//  5) 오답 후보 완전 무작위 → 철자·품사 유사도 계층. 표적은 무복원(bag) 추출.
//  6) 자체 DoneScreen(무조건 폭죽·팡파르) → gamekit GameDone. 폭죽은 8단계 완주에만.
//
// ── v08.1 적대적 감사에서 실제로 뚫린 것과 그 봉합 ──────────────────────
//  E1 카드 경제 역전 — 배수가 큰 카드(잔상 .40/혼선 .35/역방향 .30)의 실측 비용이
//     거의 0이라 최적 드래프트가 룩업 테이블 한 줄이었다.
//     → gain 을 실측 정확도 비용에 맞춰 재산정(아래 TIGHTEN_CARDS 주석에 근거).
//  E2 역방향 문항 오답 후보 붕괴 — 타일에 ko 를 렌더하면서 유사도는 en 철자만 봤다.
//     → koNearness() 신설 + buildOptions 가 form 을 받는다.
//  E3 정비 파밍 — lives<3 이면 매 단계 '정비'가 확정 제시되고 회수 상한이 없어
//     단계당 1발만 버리면 조임 0장으로 8단계 완주가 보장됐다.
//     → 안도 카드는 별도 3번 슬롯 + 판당 정비 2회·호흡 2회 상한. 1·2번은 항상 조임 2택.
//  E4 '혼선'이 작은 풀에서 증명 가능한 no-op — bandSize 가 풀 크기에 비례해
//     others 전체를 덮으면 무작위와 분포가 같았다.
//     → 밴드를 want 에 비례한 '상위 구간'으로 바꾸고 최근접 1개는 확정 포함.
//  E5 '잔상'+'문맥' = 물리적으로 못 읽음 — 170자 예문을 1.4초 고정 뒤 지웠다.
//     → 잔상 지연·문맥 여유 모두 프롬프트 길이 비례.
//  E6 램프가 카드 선택 사항이었고 단계 경계마다 +140ms 톱니 — 카드를 안 사면
//     첫 30초와 마지막 30초의 창이 수치상 거의 같았다.
//     → 창은 누적 문항 수(0~39)의 단조 함수. 4단계부터 선택지 강제 +1.
//  E7 0단계 전멸 — 정답률 60% 학습자의 약 1/3이 조임 카드를 한 장도 못 보고 끝났다.
//     → 0단계는 '연습 사격'(목숨 차감 없음). 핵심 메커닉을 반드시 한 번은 만난다.
//  E8 (E3 의 반작용) 정비를 2회로 묶자 8단계 완주가 어떤 실력에서도 0%가 됐다 —
//     닿을 수 없는 배지는 없는 배지다. → '무결점 단계'에 목숨 +1 을 붙였다.
//     일부러 질 수 없으므로 파밍 불가, 실력에만 열린다(완주율 p0.9 13% / p0.65 0.7%).
//  E9 세션 XP 가 정확도와 무관(오답도 +30점)이라 '아무 타일이나 난타'가 순이득이었다.
//     → page.tsx 의 computeScore 부호 반전(정답×120 − 오답×30, 하한 0).
//
// ── v08.2 자료 크기 대응 — "고른 자료로는 못 여는 게임"을 없앤다 ─────────
//  입장 하한이 10 이라 공용 단어장 + 도서 챕터 653 세트 중 **20.8%** 가 거절됐다
//  (세트 크기 1사분위 11단어 · 중앙값 30 · 최소 1). 단어가 적으면 판이 짧아지는 것이 정상이지
//  게임이 안 열리는 것은 정상이 아니다. 판의 형태를 전부 **풀 크기 n 의 함수**로 바꾸고
//  하한을 6 으로 내린다(거절 20.8% → 10.3%).
//    · stagesFor(n)   = clamp(round(n×3 / 5), 3, 8) — 한 단어를 세 번쯤 만나면 판을 접는다
//    · maxTilesFor(n) = clamp(min(n−2, ⌊n×0.75⌋), 4, 6) — 보드 밖에 **항상 2단어 이상**
//    · 창·미끼 난이도·선택지 램프를 절대 문항 수가 아니라 **진행률**로 — 20발 판도 끝은 3.2초
//    · 표적 추출은 풀 12 미만에서 무복원 bag → 가중 복원추출(근거는 drawTarget 주석)
//    · 조임 카드 게이트(혼선·표적증가·문맥·역방향)도 전부 n 의 함수 — 작은 풀에서
//      "증명 가능한 no-op 카드"가 배수만 주는 일이 없게(E4 와 같은 사고의 재발 방지)
//
//  **왜 6 아래로 못 내리는가** — 이 게임의 최소 보드는 4지선다다(3지선다는 추측률이
//  25%→33% 로 뛰고, 콤보·목숨이 걸린 속사에서 그 8%p 는 실력 신호를 덮는다).
//  거기에 "보드 밖 2단어"가 필요하다: 보드가 풀 전체를 덮으면 ⑴ 미끼 선택이 사라져
//  '혼선'이 정의상 no-op 이 되고 ⑵ 매 문항이 같은 네 장이라 인출이 위치 기억으로 바뀐다.
//  4 + 2 = 6. 5단어면 보드가 풀의 80%, 4단어면 100% 다.
//
// ── 인출 규칙(비타협) ────────────────────────────────────────────────────
//  · 제출 전 화면에는 뜻(또는 영단어, 또는 빈칸 예문) 하나뿐 — 정답 특정 정보 없음.
//  · 영단어와 뜻을 동시에 보여준 채 그 쌍을 묻지 않는다.
//  · 부분 정답 오라클 없음. 힌트로 정답을 사는 경로 없음.
//  · 정답 공개는 제출 후에만, 대신 충분히(en·뜻·발음·예문).
//
// ── FSRS 무결성 (v08.1) ──────────────────────────────────────────────────
//  보고를 **생략하지 않는다**. 모르는 단어일수록 오답으로 정직하게 올라가야 복습이 잡힌다.
//  대신 인출이 아닌 입력에는 `{ assisted: true }` 를 붙여 중앙 레코더가 카드를
//  건드리지 않게 한다(판정 기준은 record-result.ts 한 곳).
//    assisted 로 올리는 것 —
//      · 재출제(정답을 3~5문항 전에 이미 보여줬다)
//      · 그 판에서 이미 정답을 공개한 적 있는 단어의 재조우
//      · 창이 좁을 때(≤2.4초)의 시간 초과 — 스스로 고른 '가속' 탓이지 기억 실패가 아니다
//      · 연속 시간 초과 2회째부터 — 방치는 인출 시도가 아니다(3회면 판을 조용히 마친다)
//    honest 로 올리는 것 — 그 외 전부. 단어당 정직한 보고는 1회(중복 부풀리기 차단).
//
// 계약: { wordPool?, onExit?, onCorrect?(w, opts?), onWrong?(w, opts?) } + 선택적 onRestart.
// wordPool 이 오면 반드시 그 단어로 논다. 아래 BANK 는 wordPool 이 없을 때만 쓰는 맛보기.

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  AmbientBackground,
  FeedbackIcon,
  GameDone,
  GameKitStyles,
  GameMusic,
  Hud,
  Kbd,
  NotEnoughWords,
  ParticleBurst,
  TimerBar,
  clamp,
  shuffle,
  useCombo,
  useCountUp,
  useCountdown,
  usePersonalBest,
  useSfx,
  DEFAULT_COMBO_TIERS,
  type Word,
} from '@/components/game/_shared/gamekit';

/**
 * 정답을 이미 보여준 뒤의 입력인가(재출제 · 리빌 후 재조우 · 좁은 창의 시간 초과 · 방치).
 * 게임 점수·콤보·세션 정확도에는 반영하되 **FSRS 카드는 갱신하지 않는다**(record-result 판정).
 */
interface ResultOpts {
  assisted?: boolean;
}

interface WordBlitzGameProps {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (word: Word, opts?: ResultOpts) => void;
  onWrong?: (word: Word, opts?: ResultOpts) => void;
  /**
   * 다시 하기. 주면 게임은 스스로 초기화하지 않고 이것만 호출한다 —
   * 호출부가 라운드 key 를 바꿔 새 세션 레코더로 remount 하라는 뜻
   * (useGameSessionRecorder 는 1회 가드라 remount 없이는 2판째부터 scores·XP 가 0).
   * 주지 않으면 내부적으로 초기화한다.
   */
  onRestart?: () => void;
  enableSpeech?: boolean;
}

// ─── 맛보기 뱅크 (wordPool 이 없을 때만) ─────────────────────────────────
// 예문을 함께 둔다 — '문맥' 조임 카드가 예문 빈칸으로 출제하기 때문.
const BANK: Word[] = [
  { en: 'advantage', ko: '이점, 유리한 점', pos: 'n', example: 'Her height gave her a clear advantage in the match.' },
  { en: 'reserved', ko: '내성적인', pos: 'adj', example: 'He is reserved with strangers but warm with friends.' },
  { en: 'inclined', ko: '경향이 있는', pos: 'adj', example: 'She is inclined to agree with the new plan.' },
  { en: 'consequence', ko: '결과, 영향', pos: 'n', example: 'He accepted the consequence of his careless decision.' },
  { en: 'judgment', ko: '판단, 평가', pos: 'n', example: 'Trust your own judgment rather than the rumors.' },
  { en: 'ability', ko: '능력', pos: 'n', example: 'The job requires the ability to work under pressure.' },
  { en: 'balance', ko: '균형', pos: 'n', example: 'She lost her balance on the icy step.' },
  { en: 'courage', ko: '용기', pos: 'n', example: 'It took courage to admit the mistake in public.' },
  { en: 'develop', ko: '발전시키다', pos: 'v', example: 'The city plans to develop the old harbor area.' },
  { en: 'reduce', ko: '줄이다', pos: 'v', example: 'We must reduce waste in every department.' },
  { en: 'sudden', ko: '갑작스러운', pos: 'adj', example: 'A sudden noise woke the whole house.' },
  { en: 'honest', ko: '정직한', pos: 'adj', example: 'An honest answer is better than a clever excuse.' },
  { en: 'generous', ko: '관대한', pos: 'adj', example: 'The owner was generous with his time and advice.' },
  { en: 'stubborn', ko: '고집 센', pos: 'adj', example: 'The stubborn stain would not wash out.' },
  { en: 'fragile', ko: '연약한, 깨지기 쉬운', pos: 'adj', example: 'The fragile vase was wrapped in thick paper.' },
  { en: 'genuine', ko: '진짜의, 진심의', pos: 'adj', example: 'Her surprise looked completely genuine.' },
  { en: 'obvious', ko: '분명한', pos: 'adj', example: 'The answer was obvious once he explained it.' },
  { en: 'reveal', ko: '드러내다', pos: 'v', example: 'The letter may reveal who sent the warning.' },
  { en: 'hesitate', ko: '망설이다', pos: 'v', example: 'Do not hesitate to ask for help.' },
  { en: 'persuade', ko: '설득하다', pos: 'v', example: 'She tried to persuade him to stay one more day.' },
  { en: 'endure', ko: '견디다', pos: 'v', example: 'They had to endure a long, cold winter.' },
  { en: 'scarce', ko: '부족한, 드문', pos: 'adj', example: 'Fresh water became scarce after the drought.' },
  { en: 'temporary', ko: '일시적인', pos: 'adj', example: 'This is only a temporary fix for the leak.' },
  { en: 'thorough', ko: '철저한', pos: 'adj', example: 'The inspector made a thorough search of the building.' },
];

// ─── 규칙 상수 ────────────────────────────────────────────────────────────
/**
 * 게임이 성립하는 절대 하한 = 4지선다 + 보드 밖 2단어. 파일 상단 v08.2 참조.
 * page 의 minWords 도 같은 값이다 — 게임이 여는 자료를 페이지가 거절하지 않는다.
 */
const MIN_POOL = 6;
/** 보드 최소 선택지. 3지선다는 추측률 33% — 속사에서 실력 신호를 덮는다. */
const MIN_TILES = 4;
const SHOTS_PER_STAGE = 5;
/**
 * 단계 수 하한 — 연습 사격(0단계) + 조임 카드 결정 2회는 어떤 풀에서도 보장한다.
 * MIN_POOL 6 에서 stagesFor 는 이미 4를 주므로(=카드 3회) 이 값은 안전망이다.
 */
const MIN_STAGES = 3;
const MAX_STAGES = 8;
/** 한 단어를 몇 번 만나면 판을 접는가. cascade goalFor(n)=n×3 과 같은 근거. */
const SHOTS_PER_WORD = 3;
const START_LIVES = 3;
const MAX_LIVES = 3;

// ─── 풀 크기 스케일 (v08.2) ──────────────────────────────────────────────
/**
 * 판 길이 — 풀 크기의 함수. n×3 발을 5발 단계로 끊는다.
 *   n=6 → 4단계(20발, 단어당 3.3회) · n=10 → 6단계(30발) · n≥14 → 8단계(40발, 종전과 동일)
 * 하한 3단계는 "연습 사격 + 조임 카드 2회"를 보장하는 값이다 —
 * 이 모드의 유일한 결정이 카드라, 카드를 한 번도 못 보는 판은 재설계가 없는 것과 같다(E7).
 */
function stagesFor(poolSize: number): number {
  return clamp(Math.round((poolSize * SHOTS_PER_WORD) / SHOTS_PER_STAGE), MIN_STAGES, MAX_STAGES);
}

/**
 * 선택지 상한 — 보드가 풀을 다 덮지 않게 **항상 2단어를 보드 밖에** 남긴다.
 *   n=6 → 4 · n=7 → 5 · n=8 이상 → 6(종전과 동일)
 * 보드 = 풀이 되는 순간 오답 후보를 '고를' 여지가 사라져 '혼선'이 no-op 이 되고,
 * 매 문항이 같은 타일 집합이라 인출이 위치 기억으로 바뀐다.
 */
function maxTilesFor(poolSize: number): number {
  return clamp(Math.min(poolSize - 2, Math.floor(poolSize * 0.75)), MIN_TILES, 6);
}

/**
 * '문맥' 카드를 제안하려면 빈칸을 만들 수 있는 단어가 이만큼 필요하다.
 * 고정 4였다 — 풀 6에서는 2/3을 요구하는 셈이라 사실상 영구 봉인이었다. 이제 풀의 절반(상한 4).
 */
function contextNeedFor(poolSize: number): number {
  return clamp(Math.ceil(poolSize / 2), 2, 4);
}

/**
 * 단어당 재출제 상한. 작은 풀에서는 추출기가 이미 같은 단어를 3회 남짓 돌리므로
 * 재출제까지 2회를 허용하면 20발 판의 절반이 같은 두세 단어로 채워진다. 10 미만은 1회.
 */
function lapseRepeatsFor(poolSize: number): number {
  return poolSize >= 10 ? 2 : 1;
}

/** 판 진행률 0..1 — 절대 문항 수 대신 이 값으로 창·난이도·형태 램프를 몬다. */
function progressAt(totalShot: number, totalShots: number): number {
  const span = Math.max(1, totalShots - 1);
  return clamp(totalShot, 0, span) / span;
}

/**
 * 미끼 난이도(닮은 오답 강제 수) — 종전에는 stage<2/stage<4 라는 절대 단계였다.
 * 4단계짜리 짧은 판은 2단계(가장 어려운 구간)에 영영 못 갔다. 진행률 35%/70% 로 바꾼다.
 */
function hardnessFor(progress: number): number {
  return progress < 0.35 ? 0 : progress < 0.7 ? 1 : 2;
}

/**
 * 0단계는 '연습 사격' — 목숨을 깎지 않는다.
 * 근거: START_LIVES 3 / SHOTS_PER_STAGE 5 에서 정답률 0.60 학습자는 5발 중 3실점 확률이
 * 약 31.7%(= Σ_{k≥3} C(5,k)·0.4^k·0.6^(5-k))라, 세 판에 한 판꼴로 이 모드의 유일한 결정인
 * 조임 카드를 **한 장도 못 보고** 20초 만에 끝났다. 메커닉을 못 만난 판은 재설계가 없는 것과 같다.
 * 대신 실점은 stageMiss 로 세므로 '무결점 단계' 보너스는 그대로 못 받는다(공짜 아님).
 */
const PRACTICE_STAGE = 0;

/**
 * 창(문항 제한시간) — 판 **진행률**의 단조 감소 함수.
 * v08 은 stage·shot 을 따로 빼서 단계 경계마다 shot 항이 0으로 돌아갔고(+140ms 톱니 7회),
 * 카드를 안 사면 4600→3340ms(−27%)뿐이라 램프가 통째로 선택 사항이었다.
 * v08.1 은 −45ms/문항의 절대 기울기였는데, 판 길이가 풀 크기를 따라가면서
 * 20발 판은 −855ms(−17%) 밖에 못 좁혀졌다 — 짧은 판에는 후반이 없는 셈.
 * 이제 진행률 0 → 5000ms, 진행률 1 → 3245ms. **판 길이와 무관하게 같은 낙폭**, 톱니 0회.
 *
 * 기울기를 −45ms/문항으로 잡은 근거(시뮬 sweep, 정답률 0.5/0.65/0.8/0.9 × 5,000판):
 *   −90 → 어떤 실력에서도 8단계 완주 0.0%. 마지막 단계의 창(1.5초)이 4지선다를
 *          **읽는 데 드는 물리 시간**(뜻 0.54초 + 타일 4×0.25초 + 판단 0.32초 ≈ 1.86초)보다
 *          짧아, 아는 단어도 못 맞히는 구간이 생긴다. 그건 난이도가 아니라 고장이다.
 *   −65 → 완주 0.0%. 여전히 물리 하한에 걸린다.
 *   −45 → 완주 p0.9 13.3% / p0.8 6.2% / p0.65 0.7% / p0.5 0.0%.
 *          강한 학습자에게만 열리는 목표가 되고, 약한 학습자도 끝까지 '풀 수는 있는' 문항을 만난다.
 */
const BASE_WINDOW_MS = 5000;
/** 절대 하한(선택지 4개 기준). 아래 TILE_FLOOR_MS 로 선택지 수만큼 올라간다. */
const MIN_WINDOW_MS = 1700;
const MAX_WINDOW_MS = 6200;
/** 판 전체에서 창이 좁아지는 총량. v08.1 의 −45ms × 39문항 = −1755ms 를 그대로 옮겼다. */
const RAMP_TOTAL_MS = 1755;
/** '가속' 1장당 창 감소. 최대 3장이므로 최대 −1350ms — 램프(−1755)와 맞먹는 자발적 조임. */
const SPEED_TIGHTEN_MS = 450;
/**
 * '호흡' 1장당 창 증가. 350 → 250 으로 낮춘다.
 * 350 이면 2장(상한)에 +700ms — 램프 총량(−1755)의 40%를 되돌려 "안도만 먹는 빌드에는
 * 램프가 없다"에 가까웠다. 250 이면 2장에 +500ms = 28% — 안도의 값어치는 남되
 * 램프를 무효화하지는 못한다.
 */
const BREATHE_RELIEF_MS = 250;
/** 선택지가 1개 늘 때마다 훑을 것이 늘어난 만큼만 돌려준다(난이도는 후보 수로, 시간으로 벌하지 않는다). */
const TILE_GRACE_MS = 200;
/** 하한도 선택지 수를 따라간다 — 6지선다를 1.7초에 훑는 것은 물리적으로 불가능하다. */
const TILE_FLOOR_MS = 200;
/** 역방향(en→ko)은 타일이 한국어 뜻 4~6개라 훑는 데 시간이 더 든다. 250 → 150(재인 방향이 이미 쉽다). */
const REVERSE_GRACE_MS = 150;
/**
 * 이 이하로 좁아진 창의 시간 초과는 '기억 실패'가 아니라 '속도 실패'다.
 * 스스로 고른 '가속'이 자기 SRS 데이터를 오염시키지 않도록 assisted 로 올린다.
 */
const TIGHT_WINDOW_MS = 2400;

const REVEAL_OK_MS = 620;
const REVEAL_MISS_MS = 1700;

/** 판당 '정비' 최대 회수 — 상한이 없어 목숨이 무한 순환하던 파밍(E3)을 막는 유일한 수. */
const REPAIR_LIMIT = 2;
/** 판당 '호흡' 최대 회수. */
const BREATHE_LIMIT = 2;
/** '가속' 최대 중첩 — 3장이면 −1350ms 로 하한 근처. 4장째는 비용이 사라져 무의미했다. */
const SPEED_LIMIT = 3;
/**
 * 선택지 강제 +1 이 걸리는 **진행률** — 카드와 무관한 형태 램프.
 * 절대 단계(4)였다: 4단계짜리 짧은 판은 램프에 영영 못 닿았다. 8단계 판에서는 종전과 동일(20발째).
 */
const FORCED_CHOICE_AT = 0.5;

/**
 * 방치 판정은 "시간 초과"가 아니라 **"그 문항 동안 입력 이벤트가 하나도 없었다"** 로 한다.
 * 단순 연속 시간 초과로 세면 느리지만 자리에 있는 학습자(고민하다 놓친)를 방치로 오인한다 —
 * 그건 이 앱의 주 사용자를 끊는 일이다. 포인터 이동·터치·키 입력 중 아무것도 없어야 방치다.
 */
const IDLE_ASSIST_AT = 2;
/** 무입력 시간 초과 n회면 판을 조용히 마친다 — 자리를 비운 사이 오답이 쌓이지 않게. */
const IDLE_END_AT = 4;

/**
 * 무복원 bag 을 쓰는 최소 풀. 아래로는 가중 복원추출 — 근거는 drawTarget 주석(소거법).
 * 12 는 "이번 패스에 이미 나온 표적"을 머리로 추적할 수 있느냐의 경계로 잡았다
 * (작업기억 ~4항목 원칙 · 3~5초 창). 시뮬로 커버리지 손실이 0인 구간이기도 하다.
 */
const BAG_MIN_POOL = 12;

const PERFECT_STAGE_BONUS = 200;
const LAPSE_SCORE_RATIO = 0.6;

/**
 * 개인 최고 키. 판 길이가 풀 크기를 따라가면서 8단계 판과 4단계 판의 점수는
 * 비교 대상이 아니게 됐다 — 같은 키에 넣으면 작은 자료로는 영영 못 깨는 기록이 되고
 * "개인 최고까지 N점" 이 격려가 아니라 조롱이 된다. 판 길이별로 분리한다.
 * (8단계 = 종전 유일한 형태 → 기존 키를 그대로 유지해 기록이 사라지지 않는다.)
 */
function bestKeyFor(stages: number): string {
  return stages >= MAX_STAGES ? 'wordblitz-score' : `wordblitz-score-s${stages}`;
}

type Phase = 'playing' | 'reveal' | 'stage' | 'done';
type Outcome = 'correct' | 'wrong' | 'timeout';
type Rating = 'perfect' | 'great' | 'good';
/** 프롬프트 형태 — ko: 뜻→단어 / en: 단어→뜻(역방향) / context: 예문 빈칸→단어 */
type Form = 'ko' | 'en' | 'context';

const RATING_LABEL: Record<Rating, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' };

interface Question {
  key: number;
  target: Word;
  options: Word[];
  windowMs: number;
  form: Form;
  promptText: string;
  /** '잔상' 카드의 blur 시작 지연 — 프롬프트 길이 비례(E5). 카드가 없으면 무시된다. */
  blindDelayMs: number;
  isLapse: boolean;
  stage: number;
  shot: number;
}

interface Mods {
  /** '가속' 획득 수 */
  speed: number;
  /** '표적 증가' 획득 수 (선택지 +n) */
  choices: number;
  /** '혼선' 획득 수 (유사 오답 강제 +n) */
  confuse: number;
  reverse: boolean;
  blind: boolean;
  context: boolean;
  /** '호흡' 획득 수 (창 완화) */
  breathe: number;
  /** 점수 배수 — 조임 카드로만 자란다. */
  mult: number;
}

const INITIAL_MODS: Mods = {
  speed: 0,
  choices: 0,
  confuse: 0,
  reverse: false,
  blind: false,
  context: false,
  breathe: 0,
  mult: 1,
};

interface CardDef {
  id: string;
  title: string;
  /** 규칙 한 줄 — 고르기 전에 무엇이 바뀌는지 정확히 안다(공정성). */
  effect: string;
  /** 배수 증가분 */
  gain: number;
  kind: 'tighten' | 'relief';
  glyph: ReactNode;
  apply: (m: Mods) => Mods;
}

const GLYPH_SPEED = (
  <>
    <path d="M6 16h9" />
    <path d="M13 9l6 7-6 7" />
    <path d="M20 9l6 7-6 7" opacity=".55" />
  </>
);
const GLYPH_CHOICES = (
  <>
    <rect x="5" y="7" width="9" height="7" rx="1.6" />
    <rect x="18" y="7" width="9" height="7" rx="1.6" />
    <rect x="5" y="18" width="9" height="7" rx="1.6" />
    <rect x="18" y="18" width="9" height="7" rx="1.6" opacity=".55" />
  </>
);
const GLYPH_CONFUSE = (
  <>
    <path d="M6 10h20" />
    <path d="M6 16h13" opacity=".8" />
    <path d="M6 22h20" />
    <path d="M23 13l4 6" opacity=".55" />
  </>
);
const GLYPH_REVERSE = (
  <>
    <path d="M7 12h16l-4-4" />
    <path d="M25 20H9l4 4" />
  </>
);
const GLYPH_BLIND = (
  <>
    <path d="M4 16s4.6-7 12-7 12 7 12 7-4.6 7-12 7-12-7-12-7Z" />
    <circle cx="16" cy="16" r="2.6" opacity=".6" />
    <path d="M6 25L26 7" />
  </>
);
const GLYPH_CONTEXT = (
  <>
    <rect x="5" y="7" width="22" height="18" rx="2.4" />
    <path d="M9 13h8M9 18h14" opacity=".8" />
    <path d="M9 22h5" opacity=".5" />
  </>
);
const GLYPH_REPAIR = (
  <>
    <path d="M16 26S6 20 6 13.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 10 3.5C26 20 16 26 16 26Z" />
  </>
);
const GLYPH_BREATHE = (
  <>
    <circle cx="16" cy="16" r="9" />
    <path d="M16 11v5l3.5 2.5" />
  </>
);

// ── 조임 카드 경제 (v08.1 재산정) ────────────────────────────────────────
// v08 은 gain 을 "느낌"으로 붙였고, 그 결과 **배수가 가장 큰 카드의 실제 비용이 거의 0**이라
// 최적 드래프트가 '잔상·혼선·역방향은 무조건 먹고 가속·표적증가는 버린다'는 고정 표였다.
//
// 이제 gain 을 손으로 고르지 않는다. 위 구조 수정(E2·E4·E5·E6·E7)을 모두 반영한 뒤
// **한 장 단위 기대점수(EV)를 카드끼리 같게 만드는 값**을 이분 탐색으로 풀었다
// (정답률 0.65 · 풀 12 · 8,000판 × 카드 6종 × 탐색 13회).
//
//   측정된 순수 비용 (gain=0 으로 그 카드만 한 장 먹었을 때, 안도만 먹는 기준선 대비)
//     혼선   −548점 / 도달 −0.43단계   ← 가장 비싼 한 장
//     표적   −386점 / −0.31단계
//     문맥   −263점 / −0.15단계
//     잔상   −259점 / −0.22단계
//     가속   −211점 / −0.15단계
//     역방향 +120점 / +0.08단계        ← 재인 방향이라 **여전히 이득**. 그래서 gain 이 최저.
//
//   비용이 클수록 gain 이 크다. 결과 EV 분산폭 0.5% (지배 전략 없음의 기준으로 잡은 5% 이내).
//   기준선(조임 0장) 대비 목표 EV 는 ×1.15 — 조임을 고르는 것은 늘 합리적이되,
//   어느 한 장이 다른 한 장을 항상 이기지는 않는다.
const TIGHTEN_CARDS: CardDef[] = [
  {
    id: 'speed',
    title: '가속',
    effect: `사격 창 −0.45초 (최대 ${SPEED_LIMIT}장)`,
    gain: 0.38,
    kind: 'tighten',
    glyph: GLYPH_SPEED,
    apply: (m) => ({ ...m, speed: m.speed + 1 }),
  },
  {
    id: 'choices',
    title: '표적 증가',
    effect: '선택지 +1개 · 읽을 시간은 그만큼 더 (최대 2장)',
    gain: 0.55,
    kind: 'tighten',
    glyph: GLYPH_CHOICES,
    apply: (m) => ({ ...m, choices: m.choices + 1 }),
  },
  {
    id: 'confuse',
    title: '혼선',
    effect: '가장 닮은 단어가 오답으로 확정 투입 (최대 2장)',
    gain: 0.9,
    kind: 'tighten',
    glyph: GLYPH_CONFUSE,
    apply: (m) => ({ ...m, confuse: m.confuse + 1 }),
  },
  {
    id: 'context',
    title: '문맥',
    effect: '예문 빈칸으로 출제 (읽는 시간은 길이만큼 자동 추가)',
    gain: 0.6,
    kind: 'tighten',
    glyph: GLYPH_CONTEXT,
    apply: (m) => ({ ...m, context: true }),
  },
  {
    id: 'blind',
    title: '잔상',
    effect: '문제가 흐려짐 — 짧은 문제일수록 빨리 (0.7초~창의 60%)',
    gain: 0.62,
    kind: 'tighten',
    glyph: GLYPH_BLIND,
    apply: (m) => ({ ...m, blind: true }),
  },
  {
    id: 'reverse',
    // 이 카드만 난이도를 **낮춘다**. 숨기지 않고 카드 위에 그대로 쓴다 —
    // 학습자가 "안전하게 배수 조금"을 고를 수 있어야 이 화면이 진짜 2택이 된다.
    title: '역방향',
    effect: '한 발 걸러 영어→뜻 · 조금 쉬워지는 대신 배수도 가장 작음',
    gain: 0.22,
    kind: 'tighten',
    glyph: GLYPH_REVERSE,
    apply: (m) => ({ ...m, reverse: true }),
  },
];

const CARD_REPAIR: CardDef = {
  id: 'repair',
  title: '정비',
  effect: `목숨 +1 · 배수는 그대로 (판당 ${REPAIR_LIMIT}회)`,
  gain: 0,
  kind: 'relief',
  glyph: GLYPH_REPAIR,
  apply: (m) => m,
};
const CARD_BREATHE: CardDef = {
  id: 'breathe',
  title: '호흡',
  effect: `사격 창 +0.35초 · 배수는 그대로 (판당 ${BREATHE_LIMIT}회)`,
  gain: 0,
  kind: 'relief',
  glyph: GLYPH_BREATHE,
  apply: (m) => ({ ...m, breathe: m.breathe + 1 }),
};

const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  [...TIGHTEN_CARDS, CARD_REPAIR, CARD_BREATHE].map((c) => [c.id, c]),
);

// ─── 유사도 (오답 후보 난이도) ────────────────────────────────────────────
// 완전 무작위 오답은 "첫 글자만 봐도 풀림" → 인출이 아니라 스캔이 된다.
// 철자 근접·같은 품사·같은 어미를 점수화해 후반에 강제로 섞는다.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function nearness(cand: Word, target: Word): number {
  const a = cand.en.toLowerCase();
  const b = target.en.toLowerCase();
  let s = 0;
  if (a.slice(0, 2) === b.slice(0, 2)) s += 3;
  else if (a[0] === b[0]) s += 1.4;
  if (Math.abs(a.length - b.length) <= 2) s += 1;
  if (a.slice(-3) === b.slice(-3)) s += 1.6;
  if (cand.pos && target.pos && cand.pos === target.pos) s += 1.4;
  s += Math.max(0, 3 - levenshtein(a, b) * 0.5);
  return s;
}

/** '이점, 유리한 점' → ['이점','유리한','점'] — 어절/구분자 단위. */
function koTokens(ko: string): string[] {
  return ko
    .split(/[,;/·|()[\]]|\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * 역방향(en→ko) 문항의 오답 근접도.
 *
 * E2: 타일에 렌더되는 것은 opt.ko 인데 nearness() 는 cand.en/target.en 의 철자만 봤다.
 * 영어 철자로 고른 오답의 한국어 뜻은 서로 전혀 안 닮아서, 영단어를 흐릿하게만 알아도
 * 소거법으로 맞았다 — '혼선'을 아무리 쌓아도 역방향 문항은 쉬워지기만 했다.
 * 화면에 보이는 문자열(ko)로 근접도를 재야 유사도 계층이 의미를 갖는다.
 */
/**
 * 역방향 문항에서 **정답이 둘로 보이는** 후보인가.
 *
 * 역방향은 타일이 ko 라, 뜻이 사실상 같은 두 단어(예: '이점' vs '이점, 유리한 점')가
 * 같은 문항에 서면 정답이 둘이 된다 — 유사도를 높인 순간 이 사고가 실제로 가능해진다.
 * 오답 후보에서 아예 제외한다. 난이도는 '닮은 것'으로 올리되 '같은 것'으로 올리지 않는다.
 */
function koAmbiguous(cand: Word, target: Word): boolean {
  const a = cand.ko.replace(/\s+/g, '');
  const b = target.ko.replace(/\s+/g, '');
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return levenshtein(a, b) <= 1;
}

function koNearness(cand: Word, target: Word): number {
  const a = cand.ko.replace(/\s+/g, '');
  const b = target.ko.replace(/\s+/g, '');
  if (!a || !b) return 0;
  let s = 0;
  if (a.slice(0, 2) === b.slice(0, 2)) s += 3;
  else if (a[0] === b[0]) s += 1.2;
  if (Math.abs(a.length - b.length) <= 2) s += 1;
  // 같은 꼬리 — '~하다/~시키다', '~적인', '~스러운' 은 품사·의미장이 겹친다.
  if (a.length >= 2 && b.length >= 2 && a.slice(-2) === b.slice(-2)) s += 1.6;
  // 어절 공유 — '유리한 점' vs '좋은 점'
  const ta = new Set(koTokens(cand.ko));
  if (koTokens(target.ko).some((t) => t.length > 1 && ta.has(t))) s += 2;
  if (cand.pos && target.pos && cand.pos === target.pos) s += 1.4;
  s += Math.max(0, 3 - levenshtein(a, b) * 0.5);
  return s;
}

/** 고른 오답이 "아까웠다"에 해당하는가 — 니어미스 사운드/아이콘 분기. */
function isNearMiss(chosen: Word, target: Word): boolean {
  const a = chosen.en.toLowerCase();
  const b = target.en.toLowerCase();
  return a.slice(0, 3) === b.slice(0, 3) || levenshtein(a, b) <= 2;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 문맥 출제에 쓸 예문 길이 상한.
 * 170자였던 것을 140자로 낮춘다 — 170자는 어떤 창에서도 읽는 속도가 60자/초를 넘겨야 해서
 * '읽기'가 아니라 '운'이 됐다(E5). 140자면 아래 graceFor 의 상한 2.4초 여유 안에서
 * 빈칸 주변을 훑는 것이 물리적으로 가능하다.
 */
const MAX_CONTEXT_CHARS = 140;

/** 예문에서 표적(굴절형 포함)을 빈칸으로. 못 찾으면 null → 그 단어는 문맥 출제 제외. */
function blankExample(w: Word): string | null {
  const ex = w.example?.trim();
  if (!ex || ex.length < 14 || ex.length > MAX_CONTEXT_CHARS) return null;
  const forms = Array.from(new Set([w.en, ...(w.inflected ?? [])])).filter((f) => f && f.length > 1);
  let out = ex;
  for (const f of forms) out = out.replace(new RegExp(`\\b${escapeRe(f)}\\b`, 'gi'), '_____');
  if (out === ex && w.en.length > 5) {
    const stem = w.en.slice(0, w.en.length - 3);
    out = ex.replace(new RegExp(`\\b${escapeRe(stem)}[a-z]{0,5}\\b`, 'gi'), '_____');
  }
  return out === ex ? null : out;
}

function multFor(combo: number): number {
  let m = 1;
  for (const t of DEFAULT_COMBO_TIERS) if (combo >= t.at) m = t.mult;
  return m;
}

/**
 * 읽을 것이 많은 문항의 여유. 조임은 난이도지 함정이 아니다.
 *
 * 문맥은 고정 +0.9초였는데 예문 길이가 14~170자로 12배 차이가 났다 —
 * 짧은 예문에는 과잉, 긴 예문에는 물리적으로 불가능(E5). 이제 길이 비례:
 * 0.3초 + 글자당 14ms(≈70자/초 훑기), 0.6~2.4초. 60자 예문이면 +1.14초, 140자면 +2.26초.
 */
function graceFor(form: Form, promptText: string): number {
  if (form === 'context') return clamp(300 + promptText.length * 14, 600, 2400);
  if (form === 'en') return REVERSE_GRACE_MS;
  return 0;
}

/**
 * 창 = 진행률의 단조 감소 함수 + 형태별 여유 + 선택지 수 보정.
 * stage/shot 을 따로 빼지 않는 이유는 단계 경계 톱니(+140ms × 7회) 제거 — 파일 상단 E6.
 * 진행률로 모는 이유는 짧은 판(작은 풀)에도 후반을 만들기 위함 — 파일 상단 v08.2.
 *
 * 선택지 보정(+200ms/개)은 톱니가 아니다 — '표적 증가'나 진행률 50% 형태 램프로 선택지가
 * 늘 때만 한 번 오르고, **선택지 1개당 생각 시간**은 계속 줄어든다:
 *   진행률 .4 4지선다 (5000−702−540)/4 = 940ms/개 → .5 5지선다 (5000−878+200−540)/5 = 756ms/개.
 */
function windowFor(
  mods: Mods,
  totalShot: number,
  totalShots: number,
  form: Form,
  promptText: string,
  tiles: number,
): number {
  const base =
    BASE_WINDOW_MS -
    RAMP_TOTAL_MS * progressAt(totalShot, totalShots) -
    mods.speed * SPEED_TIGHTEN_MS +
    mods.breathe * BREATHE_RELIEF_MS;
  const extraTiles = Math.max(0, tiles - MIN_TILES);
  const floor = MIN_WINDOW_MS + extraTiles * TILE_FLOOR_MS;
  return Math.round(
    clamp(base, floor, MAX_WINDOW_MS) + graceFor(form, promptText) + extraTiles * TILE_GRACE_MS,
  );
}

/**
 * '잔상' blur 시작 지연 — 고정 1.4초가 문제였다(E1·E5).
 * 기본 form 의 프롬프트는 한국어 뜻 5~10자라 0.3초면 읽혀 비용이 0이었고,
 * 문맥 form 의 예문은 1.4초에 못 읽어 운이 됐다. 이제 길이 비례 + 창 비례 상한:
 *   0.4초 + 글자당 22ms, 하한 0.7초(8자 뜻이면 여기 걸린다 → 진짜 압박),
 *   상한은 창의 60%(잔상이 창을 통째로 없애지 않게).
 */
function blindDelayFor(promptText: string, windowMs: number): number {
  return clamp(400 + promptText.length * 22, 700, Math.round(windowMs * 0.6));
}

/**
 * 선택지 수. 4 + '표적 증가' 획득 수 + **카드와 무관한 형태 램프**.
 * 창만 좁히는 램프는 카드를 안 사면 형태가 판 내내 그대로였다 —
 * 판의 절반을 넘기면 아무 카드도 안 사도 선택지가 하나 는다(8단계 판에서는 종전과 같은 4단계).
 *
 * 램프는 **단계 시작 진행률**로 판정한다 — 문항별 진행률로 재면 단계 중간에 보드가 늘어
 * 직전 카드 화면이 광고한 "선택지 N개"가 거짓말이 된다.
 * 풀이 작으면 maxTilesFor(n) 이 막는다(풀 6~7은 4~5지선다 고정, 램프 없음).
 */
function tilesFor(mods: Mods, stageProgress: number, maxTiles: number): number {
  return clamp(
    MIN_TILES + mods.choices + (stageProgress >= FORCED_CHOICE_AT ? 1 : 0),
    MIN_TILES,
    maxTiles,
  );
}

// ─── 문항 타이머 (leaf) ───────────────────────────────────────────────────
// useCountdown 은 매 프레임 setState 한다. 문항 key 로 remount 되는 이 잎에 가두면
// 타일 격자와 프롬프트가 초당 60회 재조정되지 않는다.
const ShotTimer = memo(function ShotTimer({
  windowMs,
  running,
  onExpire,
}: {
  windowMs: number;
  running: boolean;
  onExpire: () => void;
}) {
  const cd = useCountdown({
    totalMs: windowMs,
    running,
    onEnd: onExpire,
    warnAtMs: Math.min(1300, Math.round(windowMs * 0.34)),
  });
  return <TimerBar frac={cd.frac} warning={cd.warning} seconds={cd.remainSec} label="이번 발 남은 시간" />;
});

// ─── 타일 보드 ────────────────────────────────────────────────────────────
const Board = memo(function Board({
  q,
  revealed,
  picked,
  outcome,
  gained,
  onPick,
}: {
  q: Question;
  revealed: boolean;
  picked: number | null;
  outcome: Outcome | null;
  gained: number;
  onPick: (i: number) => void;
}) {
  const chosen = picked != null ? q.options[picked] : null;
  const near = !!chosen && outcome === 'wrong' && isNearMiss(chosen, q.target);
  const two = q.options.length <= 2;
  return (
    <section
      className={`wbz-tiles ${two ? 'wbz-tiles--two' : ''}`}
      role="group"
      aria-label={q.form === 'en' ? '뜻 선택' : '단어 선택'}
    >
      {q.options.map((opt, i) => {
        const isPicked = picked === i;
        const isAnswer = opt.en === q.target.en;
        let tone = '';
        if (revealed) {
          if (isAnswer) tone = 'wbz-tile--correct';
          else if (isPicked) tone = 'wbz-tile--wrong';
          else tone = 'wbz-tile--dim';
        }
        return (
          <button
            key={`${q.key}-${opt.en}`}
            type="button"
            aria-disabled={revealed}
            onClick={() => {
              if (!revealed) onPick(i);
            }}
            className={`wbz-tile ${tone} ${q.form === 'en' ? 'wbz-tile--ko' : ''}`}
            style={{ animationDelay: revealed ? undefined : `${i * 0.035}s` }}
          >
            <span className="wbz-tile-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="wbz-tile-word">{q.form === 'en' ? opt.ko : opt.en}</span>
            {revealed && isAnswer && (
              <span className="wbz-tile-icon wbz-tile-icon--ok">
                <FeedbackIcon kind="correct" size={22} />
              </span>
            )}
            {revealed && isPicked && !isAnswer && (
              <span className="wbz-tile-icon wbz-tile-icon--no">
                <FeedbackIcon kind={near ? 'near' : 'wrong'} size={22} />
              </span>
            )}
            {revealed && isPicked && outcome === 'correct' && gained > 0 && (
              <span className="wbz-gain" aria-hidden="true">
                +{gained.toLocaleString()}
              </span>
            )}
            {revealed && isAnswer && outcome === 'correct' && (
              <ParticleBurst intensity={2} />
            )}
          </button>
        );
      })}
    </section>
  );
});

export function WordBlitzGame({
  wordPool,
  onExit,
  onCorrect,
  onWrong,
  onRestart,
  enableSpeech = true,
}: WordBlitzGameProps) {
  const pool = useMemo(() => {
    const p = wordPool && wordPool.length > 0 ? wordPool : BANK;
    const seen = new Set<string>();
    return p.filter((w) => {
      const k = w.en.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [wordPool]);

  // ── 판의 형태는 전부 풀 크기의 함수다(v08.2) ──
  const stages = stagesFor(pool.length);
  const totalShots = stages * SHOTS_PER_STAGE;
  const maxTiles = maxTilesFor(pool.length);
  const maxLapseRepeats = lapseRepeatsFor(pool.length);

  /** '문맥' 카드를 제안할 수 있는가 — 빈칸을 만들 수 있는 단어가 풀의 절반은 돼야 한다. */
  const contextable = useMemo(() => pool.filter((w) => blankExample(w) !== null).length, [pool]);
  const contextReady = contextable >= contextNeedFor(pool.length);

  /**
   * '역방향' 카드를 제안해도 되는가 — 어떤 표적을 뽑아도 **뜻이 겹치지 않는 오답**으로
   * 보드를 다 채울 수 있어야 한다. 작은 풀에서 뜻이 비슷한 단어가 몇 개만 있어도
   * 역방향 문항은 '정답이 둘'이 되거나 선택지가 줄어(=쉬워져) 배수만 챙기는 카드가 된다.
   * 60 초과 풀은 실패 사례가 없고 O(n²) 비용만 커서 통과시킨다(마운트 1회 계산).
   */
  const reverseSafe = useMemo(() => {
    if (pool.length > 60) return true;
    const need = Math.min(maxTiles - 1, pool.length - 1);
    return pool.every(
      (t) => pool.filter((w) => w.en !== t.en && !koAmbiguous(w, t)).length >= need,
    );
  }, [pool, maxTiles]);

  const sfx = useSfx();
  const mutedRef = useRef(false);
  mutedRef.current = sfx.muted;

  const [phase, setPhase] = useState<Phase>('playing');
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [gained, setGained] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [stage, setStage] = useState(0);
  const [shot, setShot] = useState(0);
  const [mods, setMods] = useState<Mods>(INITIAL_MODS);
  const [pickedCards, setPickedCards] = useState<string[]>([]);
  /** 1·2번 슬롯 — 항상 서로 다른 '조임' 두 장. 진짜 2택이 되도록 안도 카드를 섞지 않는다. */
  const [cardMain, setCardMain] = useState<CardDef[]>([]);
  /** 3번 슬롯 — 안도(정비/호흡). 판당 회수 상한이 있고, 없으면 null. */
  const [cardRelief, setCardRelief] = useState<CardDef | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [perfectStages, setPerfectStages] = useState(0);
  const [missed, setMissed] = useState<Word[]>([]);
  const [flash, setFlash] = useState<{ kind: 'combo' | 'stage'; text: string } | null>(null);
  const [srMsg, setSrMsg] = useState('');
  const [cleared, setCleared] = useState(false);
  /** 'idle' = 연속 시간 초과로 조용히 마침. 끝화면 문구만 바뀐다(비난 없이). */
  const [endReason, setEndReason] = useState<'lives' | 'clear' | 'idle'>('lives');
  const [finalBest, setFinalBest] = useState<{ prev: number | null; improved: boolean }>({
    prev: null,
    improved: false,
  });

  const shownScore = useCountUp(score);

  // 콤보 티어가 올라가는 순간만 배너 — 매 정답마다 터뜨리면 Calm 이 깨진다.
  const combo = useCombo({
    onTierUp: (tier, c) => {
      if (tier.label) setFlash({ kind: 'combo', text: `${tier.label} · 콤보 ${c} · ×${tier.mult}` });
    },
  });
  const best = usePersonalBest(bestKeyFor(stages), true);

  // ── 로직용 ref (rAF·타이머 콜백에서 stale 방지) ──
  const answeredGuardRef = useRef(false);
  const questionRef = useRef<Question | null>(null);
  const startAtRef = useRef(0);
  const keyRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const answeredRef = useRef(0);
  const bagRef = useRef<Word[]>([]);
  const recentRef = useRef<string[]>([]);
  /** 단어별 등장 횟수 — 작은 풀의 가중 복원추출이 커버리지를 유지하는 유일한 수단. */
  const seenCountRef = useRef(new Map<string, number>());
  const lapseRef = useRef<{ word: Word; dueAt: number }[]>([]);
  /** 단어별 재출제 횟수 — 무한 재출제를 막는 유일한 진실(큐에서 빠져도 남는다). */
  const lapseCountRef = useRef(new Map<string, number>());
  const stageMissRef = useRef(0);
  /**
   * FSRS **정직한** 보고를 이미 마친 단어. 단어당 1회 — 재출제가 학습 기록을 부풀리지 않게.
   * assisted 보고는 이 1회를 소모하지 않는다(카드를 안 건드리므로 부풀릴 것이 없다).
   */
  const gradedRef = useRef(new Set<string>());
  /** 이 판에서 정답을 이미 화면에 보여준 단어 — 이후 조우는 인출이 아니라 재인이다. */
  const revealedRef = useRef(new Set<string>());
  /** 이번 문항 동안 입력 이벤트가 하나라도 있었는가 — 방치 판정의 유일한 근거. */
  const activityRef = useRef(false);
  /** 연속 '무입력 시간 초과' 횟수. 입력이 있었거나 답을 고르면 0으로 돌아간다. */
  const idleStreakRef = useRef(0);
  /** 판당 '정비' 사용 횟수 — 목숨 무한 순환(E3) 차단. */
  const repairUsedRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const phaseRef = useRef<Phase>('playing');
  phaseRef.current = phase;

  const enoughWords = pool.length >= MIN_POOL;

  const showFlash = useCallback((kind: 'combo' | 'stage', text: string) => {
    setFlash({ kind, text });
  }, []);

  useEffect(() => {
    if (!flash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 1100);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [flash]);

  const speak = useCallback(
    (text: string) => {
      if (!enableSpeech || mutedRef.current) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.02;
        window.speechSynthesis.speak(u);
      } catch {
        /* 음성 합성 미지원 — 무해 */
      }
    },
    [enableSpeech],
  );

  /**
   * ── 표적 추출 ────────────────────────────────────────────────────────────
   * 큰 풀(≥12): 무복원 bag. 직전 3개와 겹치면 한 칸 회전. 한 패스에 전 단어를 정확히 한 번씩.
   *
   * 작은 풀(<12): **가중 복원추출**. bag 을 그대로 쓰면 소거법이 되살아나기 때문이다 —
   * 무복원은 "이번 패스에 이미 나온 단어"를 다음 패스까지 **확률 0** 으로 만든다.
   * 풀 6이면 그 소진 목록이 최대 5개, 3~5초 안에 머리로 추적 가능한 크기다. 실측(node 시뮬,
   * 각 3,000판·4지선다·뜻은 하나도 모르는 적대자):
   *     bag  — 보드 후보가 1개로 확정되는 문항 **24.9%**, 최적 추측 성공률 51.9%
   *     가중 — 확정 **0.0%**(어떤 단어도 확률 0 이 되지 않는다), 성공률 38.5%
   * 가중치 w = 1/(1+만난 횟수), 직전 2발은 ×0.35 — **배제가 아니라 약화**다.
   * 값 대신 지표로 고른 계수다: 지수 2는 적대자 43%·커버리지 100%, 지수 1은 38.5%·99.9%,
   * 무가중(순수 균등)은 25%지만 커버리지가 96%로 떨어져 안 만나고 끝나는 단어가 생긴다.
   * 커버리지 대가는 이 구간에서 거의 0 — 풀 6 에서 99.9%(bag 100%), 풀 10 에서 98.7%(bag 99.9%).
   * 반대로 풀 24 에서는 bag 94.2% → 가중 84.9% 로 벌어지므로 큰 풀은 bag 을 유지한다.
   */
  const drawTarget = useCallback((): Word => {
    if (pool.length >= BAG_MIN_POOL) {
      if (bagRef.current.length === 0) {
        let next = shuffle(pool);
        if (next.length > 1 && recentRef.current.includes(next[next.length - 1].en)) {
          next = [next[next.length - 1], ...next.slice(0, next.length - 1)];
        }
        bagRef.current = next;
      }
      const drawn = bagRef.current.pop()!;
      recentRef.current = [...recentRef.current, drawn.en].slice(-3);
      seenCountRef.current.set(drawn.en, (seenCountRef.current.get(drawn.en) ?? 0) + 1);
      return drawn;
    }

    const near = recentRef.current.slice(-2);
    const weights = pool.map((w) => {
      const base = 1 / (1 + (seenCountRef.current.get(w.en) ?? 0));
      return near.includes(w.en) ? base * 0.35 : base;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    const w = pool[idx];
    seenCountRef.current.set(w.en, (seenCountRef.current.get(w.en) ?? 0) + 1);
    recentRef.current = [...recentRef.current, w.en].slice(-3);
    return w;
  }, [pool]);

  /**
   * 오답 후보 생성.
   *
   * E4 수정 — 이전 bandSize = min(others, max(want+2, (n-1)*2)) 는 **풀 크기에 비례**했다.
   * minWords=10 스코프에서 '표적 증가'로 n=6 이면 (n-1)*2 = 10 > others=9 라 밴드가 전체가 되고,
   * 그러면 similar 는 '전체에서 무작위 want개' = 혼선 0장일 때와 분포가 완전히 같다.
   * 즉 due 10~11개인 학습자에게 '혼선'은 공짜 배수 자판기였다(증명 가능한 no-op).
   * → 밴드를 **want 에 비례한 상위 구간**으로 바꾼다. 풀이 아무리 작아도 상위 랭크만 남는다.
   *
   * 그리고 '혼선'을 실제로 고른 판에서는 최근접 1개를 **확정 투입**한다 —
   * 카드가 확률적으로 no-op 이 되는 경우 자체를 없앤다.
   *
   * E2 수정 — form 을 받아 역방향 문항에서는 화면에 보이는 ko 로 근접도를 잰다.
   */
  const buildOptions = useCallback(
    (target: Word, tiles: number, hardness: number, form: Form, forceNearest: boolean): Word[] => {
      const all = pool.filter((w) => w.en !== target.en);
      // 역방향은 타일이 ko — 뜻이 사실상 같은 후보를 빼야 '정답 둘'이 안 생긴다.
      const safe = form === 'en' ? all.filter((w) => !koAmbiguous(w, target)) : all;
      // v08.2 — 종전에는 안전 후보가 tiles−1 에 모자라면 통째로 원본(모호한 후보 포함)으로
      // 되돌렸다. 작은 풀에서는 그 분기가 실제로 열려 '정답이 둘로 보이는 문항'이 생긴다.
      // 이제는 **선택지를 한두 개 줄여서라도** 안전 후보만 쓴다 — 3지선다가 정답 둘보다 낫다.
      // ('역방향' 카드 자체가 reverseSafe 게이트를 통과해야 나오므로 여기 걸리는 일은 사실상 없다.)
      const others = safe.length >= 2 ? safe : all;
      const n = clamp(Math.min(tiles, others.length + 1), 2, tiles);
      if (others.length <= n - 1) return shuffle([target, ...others]);
      const want = clamp(hardness, 0, n - 1);
      let similar: Word[] = [];
      if (want > 0) {
        const near = form === 'en' ? koNearness : nearness;
        const ranked = [...others].sort((a, b) => near(b, target) - near(a, target));
        // want=1 → 상위 3, want=2 → 상위 4, want=4 → 상위 7. others 가 9여도 전체가 되지 않는다.
        // v08.2 — 풀이 작으면 그 값이 others 를 통째로 덮어 다시 무작위와 같아진다(E4 재발).
        // 밴드는 **가능한 한 최소 1개를 밖에 남긴다**: others 5 · want 3 이면 상위 4에서 뽑는다.
        const bandCap = Math.max(want + 1, others.length - 1);
        const bandSize = clamp(Math.min(Math.ceil(want * 1.5) + 1, bandCap), want + 1, others.length);
        const band = ranked.slice(0, bandSize);
        const forced = forceNearest ? band.slice(0, 1) : [];
        similar = [...forced, ...shuffle(band.slice(forced.length)).slice(0, want - forced.length)];
      }
      const chosenSet = new Set(similar.map((w) => w.en));
      const rest = shuffle(others.filter((w) => !chosenSet.has(w.en))).slice(0, n - 1 - similar.length);
      return shuffle([target, ...similar, ...rest]);
    },
    [pool],
  );

  const startShot = useCallback(
    (stageIdx: number, shotIdx: number) => {
      if (!mountedRef.current) return;
      const m = modsRef.current;
      const total = answeredRef.current;

      // 재출제 큐 우선 — 틀린 단어를 3~5문항 뒤에 다시 만난다.
      // 작은 풀에서는 큐의 단어를 방금 뽑았을 수 있다 → 직전 표적과 같으면 이번엔 건너뛴다
      // (같은 단어가 연속 두 문항으로 서면 "재출제"가 아니라 고장으로 읽힌다).
      let target: Word | null = null;
      let isLapse = false;
      const lastEn = recentRef.current[recentRef.current.length - 1];
      const dueIdx = lapseRef.current.findIndex((l) => l.dueAt <= total && l.word.en !== lastEn);
      if (dueIdx >= 0) {
        const [entry] = lapseRef.current.splice(dueIdx, 1);
        target = entry.word;
        isLapse = true;
        recentRef.current = [...recentRef.current, entry.word.en].slice(-3);
      }
      if (!target) target = drawTarget();

      let form: Form = 'ko';
      let promptText = target.ko;
      if (m.context) {
        const blanked = blankExample(target);
        if (blanked) {
          form = 'context';
          promptText = blanked;
        }
      }
      if (form === 'ko' && m.reverse && total % 2 === 1) {
        form = 'en';
        promptText = target.en;
      }

      const shotNo = stageIdx * SHOTS_PER_STAGE + shotIdx;
      const stageProgress = (stageIdx * SHOTS_PER_STAGE) / totalShots;
      const n = tilesFor(m, stageProgress, maxTiles);
      // 역방향 문항은 닮은 오답 +1 강제 — 재인 방향(en→ko)은 인출 방향보다 원래 쉬워서
      // 그대로 두면 '역방향'이 난이도를 **낮추면서** 배수를 주는 공짜 카드가 된다(E1·E2).
      const baseHard = hardnessFor(progressAt(shotNo, totalShots)) + (form === 'en' ? 1 : 0);
      const options = buildOptions(target, n, baseHard + m.confuse, form, m.confuse > 0 || form === 'en');
      // 창은 **실제로 렌더될 타일 수**로 잰다 — 안전 후보가 모자라 보드가 줄면 여유도 줄어야 한다.
      const windowMs = windowFor(m, shotNo, totalShots, form, promptText, options.length);

      keyRef.current += 1;
      const q: Question = {
        key: keyRef.current,
        target,
        options,
        windowMs,
        form,
        promptText,
        blindDelayMs: blindDelayFor(promptText, windowMs),
        isLapse,
        stage: stageIdx,
        shot: shotIdx,
      };
      questionRef.current = q;
      answeredGuardRef.current = false;
      activityRef.current = false;
      startAtRef.current = Date.now();
      setQuestion(q);
      setStage(stageIdx);
      setShot(shotIdx);
      setPicked(null);
      setOutcome(null);
      setRating(null);
      setGained(0);
      setPhase('playing');
    },
    [buildOptions, drawTarget, maxTiles, totalShots],
  );

  const startShotRef = useRef(startShot);
  startShotRef.current = startShot;

  // ── 단계 종료 처리 ──
  const finishStage = useCallback(
    (stageIdx: number) => {
      const clean = stageMissRef.current === 0;
      // 회복 후의 목숨을 지역 변수로 들고 간다 — setLives 는 비동기라 아래 안도 슬롯 판정이
      // livesRef 만 보면 "이미 3인데 정비를 또 내미는" 상태가 된다.
      let livesNow = livesRef.current;
      if (clean) {
        const bonus = Math.round(PERFECT_STAGE_BONUS * modsRef.current.mult);
        setScore((s) => s + bonus);
        setPerfectStages((p) => p + 1);
        // 무결점 단계 → 목숨 +1. '정비'를 3번 슬롯으로 내리고 2회로 묶은 대신,
        // **실력으로만 얻는 회복**을 연다. 일부러 질 수 없으므로 파밍이 불가능하고
        // (E3 의 '단계당 1발 버리기'는 정의상 무결점이 아니다), 완주가 도달 가능한 목표로 남는다.
        // 시뮬 5,000판: 완주율 p0.9 13.3% · p0.8 6.2% · p0.65 0.7% · p0.5 0.0%.
        // (v08.2 — 판 길이가 풀을 따라가므로 짧은 판일수록 완주가 쉬워진다. 대신 창 낙폭이
        //  같은 총량을 짧은 판에 몰아 넣어 문항당 압박은 더 가파르다. 개인 최고 기록도
        //  bestKeyFor 로 판 길이별로 분리해 서로 다른 길이를 겨루게 두지 않는다.)
        const healed = stageIdx > PRACTICE_STAGE && livesNow < MAX_LIVES;
        if (healed) {
          livesNow = Math.min(MAX_LIVES, livesNow + 1);
          setLives(livesNow);
        }
        showFlash('stage', healed ? `무결점 단계 +${bonus.toLocaleString()} · 목숨 +1` : `무결점 단계 +${bonus.toLocaleString()}`);
        sfx.coin();
      }
      stageMissRef.current = 0;

      if (stageIdx + 1 >= stages) {
        setCleared(true);
        setEndReason('clear');
        setPhase('done');
        setQuestion(null);
        questionRef.current = null;
        return;
      }

      // ── 카드 제시 (E3 수정) ────────────────────────────────────────────
      // v08 은 slotB 를 lives<3 이면 '정비'로 확정했다. 회수 상한이 없어서
      // '단계당 딱 1발만 일부러 버린다'를 반복하면 목숨이 순환해 조임 0장으로 8단계
      // 완주가 보장됐고, 동시에 "두 장 중 방향을 고른다"는 이 모드의 핵심 주장도
      // 거짓이 됐다(정석 플레이어는 방향 선택 화면을 판 내내 한 번도 못 봤다).
      //
      // → 1·2번은 **항상 서로 다른 조임 두 장**. 안도는 3번 슬롯으로 내리고 회수 상한을 건다.
      //
      // v08.2 — 게이트는 전부 풀 크기의 함수다. 작은 풀에서 **효과가 증명 가능하게 0인 카드**가
      // 배수만 주고 팔리면 그게 곧 익스플로짓이다(E4 가 정확히 그 사고였다).
      //   표적 증가 — maxTilesFor(n) 이 이미 막는다(풀 6~7은 보드가 안 큰다)
      //   혼선     — 보드 밖에 미끼 후보가 남아야 '고르는' 의미가 있다(= 풀 ≥ 보드+2)
      //   문맥     — 빈칸을 만들 수 있는 단어가 풀의 절반 이상
      //   역방향   — 뜻이 겹치지 않는 오답으로 보드를 채울 수 있어야(reverseSafe)
      const m = modsRef.current;
      const avail = TIGHTEN_CARDS.filter((c) => {
        if (c.id === 'speed') return m.speed < SPEED_LIMIT;
        if (c.id === 'choices') return m.choices < 2 && maxTiles >= MIN_TILES + m.choices + 1;
        if (c.id === 'confuse') return m.confuse < 2 && pool.length >= maxTiles + 2;
        if (c.id === 'reverse') return !m.reverse && reverseSafe;
        if (c.id === 'blind') return !m.blind;
        if (c.id === 'context') return !m.context && contextReady;
        return false;
      });
      const shuffledAvail = shuffle(avail);
      const main = shuffledAvail.slice(0, 2);

      let relief: CardDef | null = null;
      if (livesNow < MAX_LIVES && repairUsedRef.current < REPAIR_LIMIT) relief = CARD_REPAIR;
      else if (m.breathe < BREATHE_LIMIT) relief = CARD_BREATHE;
      // 조임이 한 장뿐이면 그때만 안도를 2번 슬롯으로 끌어올린다(빈 슬롯 방지).
      if (main.length < 2 && relief) {
        main.push(relief);
        relief = null;
      }
      // 작은 풀에서는 실제로 도달한다(풀 6이면 '표적 증가'가 통째로 빠진다) — 빈 화면은 절대 없다.
      if (main.length === 0) main.push(CARD_BREATHE);

      setCardMain(main);
      setCardRelief(relief);
      setStage(stageIdx + 1);
      setShot(0);
      setPhase('stage');
      setQuestion(null);
      questionRef.current = null;
    },
    [contextReady, maxTiles, pool.length, reverseSafe, sfx, showFlash, stages],
  );

  const finishStageRef = useRef(finishStage);
  finishStageRef.current = finishStage;

  const endRun = useCallback(() => {
    setPhase('done');
    setQuestion(null);
    questionRef.current = null;
  }, []);

  // ── 제출 ──
  const answer = useCallback(
    (tileIndex: number | null) => {
      if (answeredGuardRef.current) return;
      const q = questionRef.current;
      if (!q) return;
      answeredGuardRef.current = true;

      const chosen = tileIndex === null ? null : q.options[tileIndex];
      const isCorrect = !!chosen && chosen.en === q.target.en;
      const elapsed = Date.now() - startAtRef.current;
      const remainRatio = clamp(1 - elapsed / q.windowMs, 0, 1);
      const timedOut = tileIndex === null;

      // ── FSRS 무결성 판정 (파일 상단 "FSRS 무결성" 참조) ──────────────
      const idleShot = timedOut && !activityRef.current;
      idleStreakRef.current = idleShot ? idleStreakRef.current + 1 : 0;
      const idleFail = idleShot && idleStreakRef.current >= IDLE_ASSIST_AT;
      const speedFail = timedOut && q.windowMs <= TIGHT_WINDOW_MS;
      const seenAnswer = revealedRef.current.has(q.target.en);
      const assisted = q.isLapse || seenAnswer || idleFail || speedFail;
      // 보고는 **생략하지 않는다** — 모르는 단어일수록 오답으로 정직하게 올라가야 복습이 잡힌다.
      // 정직한 보고는 단어당 1회, assisted 는 몇 번이든(카드를 안 건드리므로 부풀릴 것이 없다).
      const report = assisted || !gradedRef.current.has(q.target.en);
      if (report && !assisted) gradedRef.current.add(q.target.en);
      // 이 문항의 리빌이 곧 정답을 보여준다 → 이후 이 단어의 조우는 전부 재인이다.
      revealedRef.current.add(q.target.en);

      answeredRef.current += 1;
      setAnswered(answeredRef.current);
      setPicked(tileIndex);

      let nextLives = livesRef.current;

      if (isCorrect) {
        const c = combo.hit();
        const rt: Rating = remainRatio > 0.62 ? 'perfect' : remainRatio > 0.34 ? 'great' : 'good';
        const ratingBonus = rt === 'perfect' ? 40 : rt === 'great' ? 20 : 0;
        const raw = (100 + Math.round(remainRatio * 60) + ratingBonus) * multFor(c) * modsRef.current.mult;
        const g = Math.round(raw * (q.isLapse ? LAPSE_SCORE_RATIO : 1));
        setGained(g);
        setScore((s) => s + g);
        setRating(rt);
        setCorrectCount((n) => n + 1);
        setOutcome('correct');
        setSrMsg(`정답 ${q.target.en}. 콤보 ${c}. ${g}점.`);
        sfx.correct(c, false);
        speak(q.target.en);
        if (report) onCorrect?.(q.target, assisted ? { assisted: true } : undefined);
      } else {
        combo.miss();
        // 0단계는 '연습 사격' — 목숨을 깎지 않는다(E7). 실점은 세므로 무결점 보너스는 없다.
        const practice = q.stage === PRACTICE_STAGE;
        if (!practice) {
          nextLives = Math.max(0, livesRef.current - 1);
          setLives(nextLives);
        }
        stageMissRef.current += 1;
        setOutcome(timedOut ? 'timeout' : 'wrong');
        setRating(null);
        setGained(0);
        setMissed((prev) => (prev.some((w) => w.en === q.target.en) ? prev : [...prev, q.target]));
        const tail = practice ? '연습 사격이라 목숨은 그대로예요.' : `남은 목숨 ${nextLives}.`;
        setSrMsg(
          timedOut
            ? `시간 초과. 정답은 ${q.target.en}, 뜻은 ${q.target.ko}. ${tail}`
            : `오답. 정답은 ${q.target.en}, 뜻은 ${q.target.ko}. ${tail}`,
        );
        if (chosen && isNearMiss(chosen, q.target)) sfx.nearMiss();
        else sfx.wrong();
        speak(q.target.en);
        if (report) onWrong?.(q.target, assisted ? { assisted: true } : undefined);
        // 세션 내 복구 기회 — 3~5문항 뒤 재출제(단어당 상한은 풀 크기의 함수).
        const queued = lapseCountRef.current.get(q.target.en) ?? 0;
        if (queued < maxLapseRepeats) {
          lapseCountRef.current.set(q.target.en, queued + 1);
          lapseRef.current = [
            ...lapseRef.current.filter((l) => l.word.en !== q.target.en),
            { word: q.target, dueAt: answeredRef.current + 3 + Math.floor(Math.random() * 3) },
          ];
        }
      }

      setPhase('reveal');
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(
        () => {
          if (!mountedRef.current) return;
          // 방치 가드 — 자리를 비운 사이 오답이 무한 적재되지 않게 조용히 마친다.
          // (무입력 2회째부터는 이미 assisted 라 FSRS 에는 최대 1건만 정직하게 올라간다.)
          if (idleStreakRef.current >= IDLE_END_AT) {
            setEndReason('idle');
            endRun();
            return;
          }
          if (nextLives <= 0) {
            endRun();
            return;
          }
          const nextShot = q.shot + 1;
          if (nextShot >= SHOTS_PER_STAGE) finishStageRef.current(q.stage);
          else startShotRef.current(q.stage, nextShot);
        },
        isCorrect ? REVEAL_OK_MS : REVEAL_MISS_MS,
      );
    },
    [combo, endRun, maxLapseRepeats, onCorrect, onWrong, sfx, speak],
  );

  const answerRef = useRef(answer);
  answerRef.current = answer;

  const onPick = useCallback((i: number) => answerRef.current(i), []);
  const onExpire = useCallback(() => answerRef.current(null), []);

  // ── 조임 카드 선택 ──
  const chooseCard = useCallback(
    (card: CardDef) => {
      if (phaseRef.current !== 'stage') return;
      // 같은 틱에 두 번 눌리면(더블탭·키 리핏) 두 장을 다 먹는다 — 렌더를 기다리지 않고 잠근다.
      phaseRef.current = 'playing';
      sfx.click();
      if (card.id === 'repair') {
        repairUsedRef.current += 1;
        setLives((l) => Math.min(MAX_LIVES, l + 1));
      }
      const next = { ...card.apply(modsRef.current) };
      next.mult = Math.round((next.mult + card.gain) * 100) / 100;
      modsRef.current = next;
      setMods(next);
      setPickedCards((p) => [...p, card.id]);
      setCardMain([]);
      setCardRelief(null);
      setSrMsg(`${card.title} 선택. ${card.effect}.`);
      startShotRef.current(stageRef.current, 0);
    },
    [sfx],
  );

  const chooseCardRef = useRef(chooseCard);
  chooseCardRef.current = chooseCard;

  // ── 최종 기록 제출 ──
  useEffect(() => {
    if (phase !== 'done') return;
    const r = best.submit(scoreRef.current);
    setFinalBest({ prev: r.prev, improved: r.improved });
    if (cleared) sfx.fanfare();
    // best.submit 은 렌더마다 새 함수 — phase 전이 1회만 돌게 의도적으로 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── 마운트 / 정리 ──
  useEffect(() => {
    mountedRef.current = true;
    if (pool.length >= MIN_POOL) startShotRef.current(0, 0);
    return () => {
      mountedRef.current = false;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* 무해 */
        }
      }
    };
    // 풀은 세션 중 바뀌지 않는다(스코프 확정 후 마운트).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 방치 감지용 활동 리스너 ──
  // 답을 안 골라도 "자리에 있다"는 증거가 되는 입력들. passive 라 스크롤 성능에 영향 없다.
  useEffect(() => {
    const mark = () => {
      activityRef.current = true;
    };
    const events: (keyof WindowEventMap)[] = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'];
    for (const ev of events) window.addEventListener(ev, mark, { passive: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, mark);
    };
  }, []);

  // ── 키보드 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (Number.isNaN(n)) return;
      if (phase === 'playing' && question && n >= 1 && n <= question.options.length) {
        e.preventDefault();
        answerRef.current(n - 1);
        return;
      }
      if (phase === 'stage') {
        const offered = cardRelief ? [...cardMain, cardRelief] : cardMain;
        if (n >= 1 && n <= offered.length) {
          e.preventDefault();
          chooseCardRef.current(offered[n - 1]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, cardMain, cardRelief]);

  const handleRestart = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (onRestart) {
      onRestart();
      return;
    }
    combo.reset();
    modsRef.current = INITIAL_MODS;
    answeredRef.current = 0;
    bagRef.current = [];
    recentRef.current = [];
    seenCountRef.current = new Map();
    lapseRef.current = [];
    lapseCountRef.current = new Map();
    stageMissRef.current = 0;
    gradedRef.current = new Set();
    revealedRef.current = new Set();
    idleStreakRef.current = 0;
    activityRef.current = false;
    repairUsedRef.current = 0;
    setMods(INITIAL_MODS);
    setPickedCards([]);
    setCardMain([]);
    setCardRelief(null);
    setScore(0);
    setLives(START_LIVES);
    setAnswered(0);
    setCorrectCount(0);
    setPerfectStages(0);
    setMissed([]);
    setCleared(false);
    setEndReason('lives');
    setFlash(null);
    setSrMsg('');
    startShotRef.current(0, 0);
  }, [combo, onRestart]);

  const handleExit = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    onExit?.();
  }, [onExit]);

  if (!enoughWords) {
    return <NotEnoughWords need={MIN_POOL} onExit={onExit} />;
  }

  const accuracy = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
  const tight = question ? question.windowMs <= TIGHT_WINDOW_MS : false;
  const revealed = phase === 'reveal';
  const q = question;
  const practiceStage = stage === PRACTICE_STAGE;

  const restartHint = (() => {
    if (finalBest.improved) return '다음 판은 다른 조임 카드로 — 같은 단어도 다른 게임이 됩니다.';
    if (best.best != null && best.best > score) return `개인 최고까지 ${(best.best - score).toLocaleString()}점.`;
    return '5발마다 고르는 조임 카드가 판을 바꿉니다.';
  })();

  const badge: ReactNode = cleared ? (
    <>
      <span aria-hidden="true">🏁</span> {stages}단계 완주
    </>
  ) : finalBest.improved ? (
    <>
      <span aria-hidden="true">↗</span> 개인 최고 갱신
    </>
  ) : perfectStages > 0 ? (
    <>
      <span aria-hidden="true">◎</span> 무결점 {perfectStages}단계
    </>
  ) : undefined;

  return (
    <div className="wbz-root" data-tight={tight ? '1' : '0'} data-low={lives <= 1 ? '1' : '0'}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <GameKitStyles />
      <AmbientBackground center="#F3EEFF" mid="#CDBBF2" edge="#2A1B45" glow="rgba(190,160,255,.5)" />
      <GameMusic gameId="wordblitz" />

      <Hud
        score={shownScore}
        progress={(stage * SHOTS_PER_STAGE + shot) / totalShots}
        combo={combo.combo}
        comboMult={multFor(combo.combo)}
        lives={{ total: MAX_LIVES, left: lives, label: '남은 목숨' }}
        extra={
          // aria-hidden 이었다 — 조임 카드의 유일한 보상 지표를 AT 사용자가 못 봤다.
          // 390px 에서 display:none 이던 것도 걷어내고 가로 배치로 축소한다(개선안 5).
          <div className="wbz-meta">
            <span className="wbz-chip wbz-chip--stage">
              <span aria-hidden="true">
                단계 {Math.min(stage + 1, stages)}/{stages}
              </span>
              <span className="gk-sr">
                단계 {Math.min(stage + 1, stages)} / {stages}
              </span>
            </span>
            <span className="wbz-chip wbz-chip--mult">
              <span aria-hidden="true">×{mods.mult.toFixed(2)}</span>
              <span className="gk-sr">점수 배수 {mods.mult.toFixed(2)}배</span>
            </span>
          </div>
        }
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={onExit ? handleExit : undefined}
      />

      <div className="gk-sr" aria-live="polite" role="status">
        {srMsg}
      </div>

      {phase === 'done' ? (
        <GameDone
          lead={
            cleared
              ? '끝까지 버텼어요'
              : endReason === 'idle'
                ? '잠시 쉬었다 이어가요'
                : '오늘 잘 마쳤어요'
          }
          celebrate={cleared}
          badge={badge}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${correctCount}/${answered}`, label: `정답 · ${accuracy}%` },
            { num: `🔥 ${combo.best}`, label: '최고 콤보' },
            { num: `${Math.min(stage + 1, stages)}/${stages}단계`, label: `배수 ×${mods.mult.toFixed(2)}` },
          ]}
          best={{ prev: finalBest.prev, now: score, label: '점수', improved: finalBest.improved }}
          restartLabel="한 판 더"
          restartHint={restartHint}
          reveal={
            missed.length > 0 ? (
              <div className="wbz-recap">
                <p className="wbz-recap-title">이번 판에서 놓친 단어</p>
                <ul className="wbz-recap-list">
                  {missed.slice(0, 8).map((w) => (
                    <li key={w.en}>
                      <b className="wbz-recap-en">{w.en}</b>
                      <span className="wbz-recap-ko">{w.ko}</span>
                      {w.pron && <span className="wbz-recap-pron">{w.pron}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          footer={
            pickedCards.length > 0 ? (
              <>
                <span className="wbz-build-label">이번 판의 조임</span>
                {pickedCards.map((id, i) => (
                  <span key={`${id}-${i}`} className="wbz-build-chip">
                    {CARD_BY_ID[id]?.title ?? id}
                  </span>
                ))}
              </>
            ) : undefined
          }
          onRestart={handleRestart}
          onExit={handleExit}
        />
      ) : phase === 'stage' ? (
        <main className="wbz-cards" aria-label="조임 카드 선택">
          <p className="wbz-cards-lead">
            {stage === 1
              ? `${SHOTS_PER_STAGE}발마다 두 장 — 어느 방향으로 어려워질지 고르세요`
              : `단계 ${stage + 1}/${stages} 준비`}
          </p>
          <p className="wbz-cards-sub">
            고른 카드는 이 판 내내 남고 점수 배수를 키웁니다. 현재 ×{mods.mult.toFixed(2)}
          </p>
          <div className="wbz-card-row">
            {cardMain.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`wbz-card wbz-card--${c.kind}`}
                onClick={() => chooseCardRef.current(c)}
              >
                <span className="wbz-card-top">
                  <svg
                    viewBox="0 0 32 32"
                    className="wbz-card-glyph"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {c.glyph}
                  </svg>
                  <span className="wbz-card-gain">
                    {c.gain > 0 ? `배수 +${c.gain.toFixed(2)}` : '배수 유지'}
                  </span>
                </span>
                <span className="wbz-card-title">{c.title}</span>
                <span className="wbz-card-effect">{c.effect}</span>
                <span className="wbz-card-key">
                  <Kbd>{i + 1}</Kbd>
                </span>
              </button>
            ))}
          </div>

          {/* 안도는 조임과 나란히 서지 않는다 — 나란히 두면 "두 방향 중 하나"라는 결정이
              "위험 예/아니오"로 붕괴하고, 회수 상한이 없으면 목숨이 순환한다(E3). */}
          {cardRelief && (
            <button
              type="button"
              className="wbz-relief"
              onClick={() => chooseCardRef.current(cardRelief)}
            >
              <svg
                viewBox="0 0 32 32"
                className="wbz-relief-glyph"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {cardRelief.glyph}
              </svg>
              <span className="wbz-relief-body">
                <span className="wbz-relief-title">{cardRelief.title}</span>
                <span className="wbz-relief-effect">{cardRelief.effect}</span>
              </span>
              <span className="wbz-relief-key">
                <Kbd>{cardMain.length + 1}</Kbd>
              </span>
            </button>
          )}

          <p className="wbz-cards-foot">
            지금 기준 — 창{' '}
            {(
              windowFor(
                mods,
                stage * SHOTS_PER_STAGE,
                totalShots,
                'ko',
                '',
                tilesFor(mods, (stage * SHOTS_PER_STAGE) / totalShots, maxTiles),
              ) / 1000
            ).toFixed(1)}
            초 · 선택지 {tilesFor(mods, (stage * SHOTS_PER_STAGE) / totalShots, maxTiles)}개 · 목숨{' '}
            {lives}/{MAX_LIVES}
            {repairUsedRef.current > 0 && ` · 정비 ${repairUsedRef.current}/${REPAIR_LIMIT}회 씀`}
          </p>
        </main>
      ) : q ? (
        <main className="wbz-stage" key={q.key}>
          <section className="wbz-prompt">
            <div className="wbz-prompt-head">
              <span className="wbz-prompt-label">
                {q.form === 'context' ? '빈칸에 들어갈 단어는?' : q.form === 'en' ? '이 단어의 뜻은?' : '이 뜻의 단어는?'}
              </span>
              {q.isLapse && (
                <span className="wbz-chip wbz-chip--lapse">
                  <span aria-hidden="true">↺</span> 다시 만난 단어
                </span>
              )}
              {practiceStage && (
                <span className="wbz-chip wbz-chip--practice">
                  <span aria-hidden="true">◦</span> 연습 사격 · 목숨 안 깎여요
                </span>
              )}
            </div>

            <h1
              className={`wbz-prompt-text ${q.form === 'en' ? 'wbz-prompt-text--en' : ''} ${
                q.form === 'context' ? 'wbz-prompt-text--ctx' : ''
              } ${mods.blind && !revealed ? 'wbz-blind' : ''}`}
              // '잔상' 지연은 프롬프트 길이에 비례한다 — 고정 1.4초는 짧은 뜻엔 공짜였고
              // 긴 예문엔 물리적으로 불가능했다(E1·E5).
              style={mods.blind ? ({ '--wbz-blind-delay': `${q.blindDelayMs}ms` } as CSSProperties) : undefined}
            >
              {q.promptText}
            </h1>

            <div className="wbz-timer-wrap">
              <ShotTimer key={q.key} windowMs={q.windowMs} running={!revealed} onExpire={onExpire} />
            </div>

            {revealed && outcome === 'correct' && rating && (
              <div className={`wbz-verdict wbz-verdict--${rating}`}>
                <FeedbackIcon kind="correct" size={16} />
                <span>{RATING_LABEL[rating]}</span>
                {q.isLapse && <span className="wbz-verdict-note">복구 · 점수 60%</span>}
              </div>
            )}

            {revealed && outcome !== 'correct' && (
              <div className="wbz-answer" role="group" aria-label="정답 공개">
                <span className={`wbz-answer-tag ${outcome === 'timeout' ? 'wbz-answer-tag--time' : ''}`}>
                  <FeedbackIcon kind="wrong" size={14} />
                  {outcome === 'timeout' ? '시간 초과' : '오답'}
                </span>
                <div className="wbz-answer-body">
                  <b className="wbz-answer-en">{q.target.en}</b>
                  <span className="wbz-answer-ko">{q.target.ko}</span>
                  {q.target.pron && <span className="wbz-answer-pron">{q.target.pron}</span>}
                  {q.target.example && <span className="wbz-answer-ex">{q.target.example}</span>}
                </div>
              </div>
            )}
          </section>

          <Board
            q={q}
            revealed={revealed}
            picked={picked}
            outcome={outcome}
            gained={gained}
            onPick={onPick}
          />

          <p className="wbz-hint" aria-hidden="true">
            탭 또는 <Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> · {SHOTS_PER_STAGE}발마다 조임 카드 ·{' '}
            {practiceStage ? '연습 사격 (목숨 유지)' : `목숨 ${lives}`}
          </p>
        </main>
      ) : null}

      {/* 배너는 본문 뒤에 둔다 — 앞에 두면 같은 z-index 의 본문이 위로 덮는다. */}
      {flash && (
        <div className={`wbz-flash wbz-flash--${flash.kind}`} aria-hidden="true">
          {flash.text}
        </div>
      )}
    </div>
  );
}

// 테마 토큰 기반(라이트/다크 자동). 게임 예외로 --combo/--streak 사용.
const STYLES = `
  .wbz-root {
    /* dvh 미지원 브라우저용 폴백 → 지원 시 뒤 선언이 이긴다(iOS 주소창 대응). */
    position: relative; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;
    display: flex; flex-direction: column;
    background: var(--bg2); color: var(--t1);
    font-family: var(--font-display, system-ui, sans-serif); user-select: none;
  }
  .wbz-root > :not(.gk-atmos):not(.gk-music-btn) { position: relative; z-index: 1; }
  /* 창이 좁아진 후반 — 색만 바꾸는 조용한 압박(폭죽·번쩍임 아님) */
  .wbz-root[data-tight="1"] .wbz-prompt-text { text-shadow: 0 0 24px color-mix(in srgb, var(--streak) 24%, transparent); }
  .wbz-root[data-low="1"]::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
    box-shadow: inset 0 0 120px 8px color-mix(in srgb, var(--error) 16%, transparent);
  }

  .wbz-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .wbz-chip--practice { color: var(--t2); border-color: color-mix(in srgb, var(--success) 42%, var(--bd)); }
  .wbz-chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 74%, transparent);
    font-size: 11px; font-weight: 800; color: var(--t2); letter-spacing: -.01em; white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .wbz-chip--mult { color: var(--combo); border-color: color-mix(in srgb, var(--combo) 42%, var(--bd)); }
  .wbz-chip--lapse { color: var(--t2); border-color: color-mix(in srgb, var(--active, var(--combo)) 45%, var(--bd)); }

  .wbz-flash {
    position: absolute; top: 21%; left: 50%; transform: translateX(-50%); z-index: 3; pointer-events: none;
    font-size: clamp(17px, 4.2vw, 26px); font-weight: 900; letter-spacing: -.01em; text-align: center;
    animation: wbz-flash .95s var(--ease, ease-out) forwards;
  }
  .wbz-flash--combo { color: var(--streak); text-shadow: 0 4px 22px color-mix(in srgb, var(--streak) 55%, transparent); }
  .wbz-flash--stage { color: var(--combo); text-shadow: 0 4px 22px color-mix(in srgb, var(--combo) 45%, transparent); }

  .wbz-stage {
    flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: clamp(18px, 3.6vh, 38px); padding: 18px 16px; animation: wbz-in .24s var(--ease, ease-out);
  }
  .wbz-prompt {
    width: 100%; max-width: 640px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    text-align: center; min-height: clamp(158px, 26vh, 210px); justify-content: flex-start;
  }
  .wbz-prompt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .wbz-prompt-label { font-size: 12px; font-weight: 800; letter-spacing: .09em; color: var(--t3); text-transform: uppercase; }
  .wbz-prompt-text {
    margin: 0; font-size: clamp(24px, 5.6vw, 42px); font-weight: 800; color: var(--t1); line-height: 1.18;
    word-break: keep-all; overflow-wrap: anywhere;
  }
  .wbz-prompt-text--en { font-family: var(--font-english, var(--font-display, system-ui)); word-break: normal; }
  .wbz-prompt-text--ctx {
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(16px, 3.4vw, 24px); font-weight: 700; line-height: 1.5; max-width: 34ch;
  }
  /* '잔상' 카드 — 규칙이지 장식이 아니라 reduced-motion 에서도 유지한다.
     지연은 프롬프트 길이 비례(--wbz-blind-delay, blindDelayFor). 폴백 1.4초는 구형 브라우저용. */
  .wbz-blind { animation: wbz-blur .55s ease var(--wbz-blind-delay, 1400ms) forwards; }

  .wbz-timer-wrap { width: min(320px, 82%); }

  .wbz-verdict {
    display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 900; letter-spacing: .04em;
    animation: wbz-rise .5s var(--ease, ease-out);
  }
  .wbz-verdict--perfect { color: var(--streak); font-size: 16px; }
  .wbz-verdict--great { color: var(--combo); }
  .wbz-verdict--good { color: var(--success); }
  .wbz-verdict-note { font-size: 11.5px; font-weight: 700; color: var(--t3); letter-spacing: 0; }

  .wbz-answer {
    display: flex; align-items: flex-start; gap: 10px; text-align: left;
    max-width: min(560px, 94vw); padding: 10px 14px; border-radius: var(--r-lg, 14px);
    border: 1px solid color-mix(in srgb, var(--error) 34%, var(--bd));
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    animation: wbz-rise .3s var(--ease, ease-out);
  }
  .wbz-answer-tag {
    display: inline-flex; align-items: center; gap: 5px; flex: none; margin-top: 2px;
    font-size: 11.5px; font-weight: 800; color: var(--error); white-space: nowrap;
  }
  .wbz-answer-tag--time { color: var(--warning); }
  .wbz-answer-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .wbz-answer-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 21px; font-weight: 800; color: var(--t1); overflow-wrap: anywhere; }
  .wbz-answer-ko { font-size: 14px; font-weight: 700; color: var(--t2); }
  .wbz-answer-pron { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 12.5px; color: var(--t3); }
  .wbz-answer-ex { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); line-height: 1.5; }

  .wbz-tiles { width: 100%; max-width: 640px; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(10px, 2.2vw, 16px); }
  .wbz-tiles--two { grid-template-columns: 1fr; max-width: 420px; }
  .wbz-tile {
    position: relative; overflow: visible; display: flex; align-items: center; gap: 10px;
    min-height: 74px; padding: 14px 16px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: var(--bg); color: var(--t1);
    font-family: var(--font-english, var(--font-display, system-ui));
    font-size: clamp(15px, 3.4vw, 23px); font-weight: 700; cursor: pointer; text-align: left;
    transition: transform .14s var(--ease, ease-out), border-color .15s, background .15s, box-shadow .15s, opacity .15s;
    animation: wbz-tile-in .28s var(--ease, ease-out) both;
  }
  .wbz-tile--ko { font-family: var(--font-display, system-ui); font-size: clamp(14px, 3.1vw, 20px); word-break: keep-all; }
  .wbz-tile:hover:not([aria-disabled="true"]) { border-color: var(--combo); transform: translateY(-3px); box-shadow: 0 8px 24px color-mix(in srgb, var(--combo) 18%, transparent); }
  .wbz-tile:active:not([aria-disabled="true"]) { transform: translateY(0) scale(.96); }
  .wbz-tile:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  /* 리빌에 disabled 를 걸면 포커스가 날아간다 — aria-disabled + 핸들러 가드. */
  .wbz-tile[aria-disabled="true"] { cursor: default; animation: none; }
  .wbz-tile-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; flex: none; border-radius: 7px; background: var(--bg3); color: var(--t3);
    font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 800;
  }
  .wbz-tile-word { flex: 1; min-width: 0; overflow-wrap: anywhere; hyphens: auto; }
  .wbz-tile-icon { flex: none; display: inline-flex; animation: wbz-pop .34s var(--ease, ease-out) .04s both; }
  .wbz-tile-icon--ok { color: var(--success); }
  .wbz-tile-icon--no { color: var(--error); }
  .wbz-tile--correct {
    border-color: var(--success); background: var(--success-light); color: var(--success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 32%, transparent), 0 8px 30px color-mix(in srgb, var(--success) 26%, transparent);
    animation: wbz-correct .4s var(--ease, ease-out);
  }
  .wbz-tile--correct .wbz-tile-num { background: var(--success); color: var(--ti); }
  .wbz-tile--wrong { border-color: var(--error); background: var(--error-light); color: var(--error); animation: wbz-shake .34s ease-in-out; }
  .wbz-tile--dim { opacity: .4; }
  .wbz-gain {
    position: absolute; top: 3px; right: 10px; font-family: var(--font-display, system-ui);
    font-size: 14px; font-weight: 900; color: var(--success); font-variant-numeric: tabular-nums;
    animation: wbz-gain .8s var(--ease, ease-out) forwards;
  }

  .wbz-hint { margin: 0; font-size: 12px; color: var(--t3); text-align: center; }

  /* ── 조임 카드 선택 ── */
  .wbz-cards {
    flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 22px 16px; animation: wbz-in .26s var(--ease, ease-out); overflow-y: auto;
  }
  .wbz-cards-lead {
    margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic;
    font-size: clamp(18px, 4.2vw, 26px); font-weight: 500; color: var(--t1); text-align: center;
  }
  .wbz-cards-sub { margin: 0; font-size: 13px; color: var(--t3); text-align: center; max-width: 36ch; }
  .wbz-card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 620px; }
  .wbz-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 7px;
    min-height: 148px; padding: 16px; border-radius: var(--r-lg, 14px);
    border: 1.5px solid var(--bd); background: color-mix(in srgb, var(--bg) 88%, transparent);
    color: var(--t1); text-align: left; cursor: pointer;
    transition: transform .16s var(--ease, ease-out), border-color .15s, box-shadow .15s, background .15s;
  }
  .wbz-card:hover { transform: translateY(-3px); border-color: var(--combo); box-shadow: 0 10px 28px color-mix(in srgb, var(--combo) 18%, transparent); }
  .wbz-card:active { transform: translateY(0) scale(.975); }
  .wbz-card:focus-visible { outline: none; border-color: var(--combo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--combo) 32%, transparent); }
  .wbz-card:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .wbz-card--relief { border-color: color-mix(in srgb, var(--success) 40%, var(--bd)); }
  .wbz-card--relief:hover { border-color: var(--success); box-shadow: 0 10px 28px color-mix(in srgb, var(--success) 18%, transparent); }
  .wbz-card--relief .wbz-card-glyph { color: var(--success); }
  .wbz-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
  .wbz-card-glyph { width: 26px; height: 26px; color: var(--combo); flex: none; }
  .wbz-card-gain { font-size: 11px; font-weight: 800; color: var(--t3); font-variant-numeric: tabular-nums; }
  .wbz-card-title { font-size: 17px; font-weight: 900; letter-spacing: -.01em; }
  .wbz-card-effect { font-size: 12.5px; font-weight: 600; color: var(--t2); line-height: 1.45; word-break: keep-all; }
  .wbz-card-key { margin-top: auto; }
  .wbz-cards-foot { margin: 0; font-size: 12px; color: var(--t3); text-align: center; font-variant-numeric: tabular-nums; }

  /* 안도 카드 — 조임 2택 아래의 secondary 슬롯(시각적으로 명백히 다른 층). */
  .wbz-relief {
    display: flex; align-items: center; gap: 12px; width: 100%; max-width: 620px;
    min-height: 60px; padding: 12px 16px; border-radius: var(--r-lg, 14px);
    border: 1.5px dashed color-mix(in srgb, var(--success) 46%, var(--bd));
    background: color-mix(in srgb, var(--bg) 62%, transparent);
    color: var(--t1); text-align: left; cursor: pointer;
    transition: transform .16s var(--ease, ease-out), border-color .15s, box-shadow .15s, background .15s;
  }
  .wbz-relief:hover { transform: translateY(-2px); border-color: var(--success); background: color-mix(in srgb, var(--bg) 84%, transparent); }
  .wbz-relief:active { transform: translateY(0) scale(.985); }
  .wbz-relief:focus-visible { outline: none; border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 32%, transparent); }
  .wbz-relief:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .wbz-relief-glyph { width: 22px; height: 22px; flex: none; color: var(--success); }
  .wbz-relief-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .wbz-relief-title { font-size: 14.5px; font-weight: 900; letter-spacing: -.01em; }
  .wbz-relief-effect { font-size: 12px; font-weight: 600; color: var(--t3); word-break: keep-all; }
  .wbz-relief-key { flex: none; }

  /* ── 끝화면 부록 ── */
  .wbz-recap { text-align: left; }
  .wbz-recap-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: var(--t3); letter-spacing: .06em; text-transform: uppercase; }
  .wbz-recap-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .wbz-recap-list li { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .wbz-recap-en { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 15px; font-weight: 800; color: var(--t1); }
  .wbz-recap-ko { font-size: 13.5px; color: var(--t2); }
  .wbz-recap-pron { font-family: var(--font-english, var(--font-display, system-ui)); font-size: 12px; color: var(--t3); }
  .wbz-build-label { font-size: 11.5px; font-weight: 800; color: var(--t3); align-self: center; letter-spacing: .04em; }
  .wbz-build-chip {
    display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px;
    border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 70%, transparent);
    font-size: 12px; font-weight: 800; color: var(--t2);
  }

  @keyframes wbz-pop { 0% { transform: scale(.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes wbz-correct { 0% { transform: scale(1); } 18% { transform: scale(.98); } 55% { transform: scale(1.05); } 100% { transform: scale(1); } }
  @keyframes wbz-shake { 0%,100% { transform: translateX(0); } 18% { transform: translateX(-7px); } 38% { transform: translateX(7px); } 58% { transform: translateX(-5px); } 78% { transform: translateX(4px); } }
  @keyframes wbz-gain { 0% { opacity: 0; transform: translateY(8px) scale(.82); } 25% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 0; transform: translateY(-22px) scale(1); } }
  @keyframes wbz-flash { 0% { opacity: 0; transform: translateX(-50%) scale(.72); } 26% { opacity: 1; transform: translateX(-50%) scale(1.08); } 74% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: 0; transform: translateX(-50%) scale(1); } }
  @keyframes wbz-in { from { opacity: .45; } to { opacity: 1; } }
  @keyframes wbz-tile-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wbz-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes wbz-blur { to { filter: blur(7px); opacity: .5; } }

  @media (max-width: 400px) {
    /* 390px 에서도 조임 2택은 한 화면에 나란히 — 두 장을 비교하는 것이 이 화면의 전부다.
       세로 스택으로 바꾸면 스크롤 없이는 비교가 안 된다. */
    .wbz-card { min-height: 132px; padding: 12px; }
    .wbz-card-row { gap: 8px; }
    .wbz-card-title { font-size: 15px; }
    .wbz-card-effect { font-size: 11.5px; line-height: 1.35; }
    .wbz-card-gain { font-size: 10px; }
    .wbz-relief { min-height: 56px; padding: 10px 12px; gap: 9px; }
    /* display:none 이었다 — 배수·단계는 조임 카드의 유일한 보상 지표라 숨기면 안 된다.
       세로 2줄 대신 가로 1줄 + 10px 로 축소해 HUD 높이를 먹지 않게 한다. */
    .wbz-meta { flex-direction: row; align-items: center; gap: 4px; }
    .wbz-meta .wbz-chip { font-size: 10px; padding: 2px 6px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .wbz-tile, .wbz-card { transition: none; }
    .wbz-tile, .wbz-stage, .wbz-cards, .wbz-tile--correct, .wbz-tile--wrong,
    .wbz-gain, .wbz-tile-icon, .wbz-verdict, .wbz-answer { animation: none !important; }
    .wbz-flash { animation: wbz-in .2s ease forwards; }
    /* '잔상'은 장식이 아니라 학습자가 스스로 고른 게임 규칙이다 —
       여기서 끄면 카드가 무효가 되므로 유지한다(전정계 자극이 없는 블러). */
  }
`;
