// apps/web/src/lib/analytics/events.ts
//
// 공개 퍼널 이벤트 정의 — **무엇을 보낼 수 있는지 타입이 강제한다.**
//
// 왜 이 파일이 따로 있나:
//   `/fit` 은 "붙여넣은 지문은 저장하지 않습니다" 를 화면에 약속한다. 그 약속은 우리 DB 뿐
//   아니라 **분석 도구에도** 적용된다. 그런데 분석 코드는 보통 `capture('x', {...아무거나})`
//   형태라, 나중에 누군가 편한 마음으로 지문 일부를 넣어도 아무도 못 막는다.
//   → 이벤트와 속성을 **닫힌 목록**으로 못 박고, 값은 숫자·불리언·짧은 열거형만 허용한다.
//     문자열 자유 입력을 아예 타입에서 없앴다. 회귀가 이 계약을 검사한다.
//
// 무엇을 재려는가 (2026-08-16 진단 §6):
//   10만 경로는 교사 3,500명 × 학급 30명(CAC 0)이다. 그 경로가 작동하는지 보려면
//   **교사 한 명이 들어와서 → 써 보고 → 공유하고 → 그 링크로 다음 사람이 오는지**를 세야 한다.
//   지금은 그 다섯 단계 중 **아무것도 셀 수 없다**(PostHog 키만 있고 코드가 없었다).

/** 학습자 레벨 축 — 프로파일과 같은 값만 허용한다. */
type LevelValue = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null

/**
 * 공개 퍼널 이벤트. **이 목록에 없는 이벤트는 보낼 수 없다.**
 *
 * 속성은 전부 숫자·불리언·닫힌 열거형이다 — 자유 문자열이 하나도 없다는 것이
 * "지문이 샐 수 없다" 의 구조적 근거다.
 */
export type PublicEvent =
  /** `/fit` 진입 — 퍼널의 분모 */
  | { name: 'fit_viewed'; props: { shared: boolean } }
  /** 분석 1회 완료 — "실제로 써 봤다" */
  | {
      name: 'fit_analyzed'
      props: {
        /** 적정 레벨 (없으면 null) */
        fitLevel: LevelValue
        /** 러닝 워드 수 — 자릿수만 의미 있으므로 버킷으로 접는다 */
        sizeBucket: 'xs' | 's' | 'm' | 'l' | 'xl'
        /** 레벨 해석률 10% 단위 (0~10) — 사각지대가 실사용에서 얼마나 큰지 */
        resolvedDecile: number
      }
    }
  /** 결과 링크 복사 — 확산의 시작점 */
  | { name: 'fit_shared'; props: { fitLevel: LevelValue } }
  /** 공유 링크로 진입 — **확산 계수의 분자**. 이 수가 0 이면 교사 채널은 작동하지 않는 것이다 */
  | { name: 'fit_share_opened'; props: { valid: boolean } }
  /** 가입 유도 클릭 — 공개 화면에서 제품으로 넘어가는 유일한 문 */
  | { name: 'fit_signup_clicked'; props: Record<string, never> }
  /**
   * 학습지 인쇄 — **가입보다 강한 의도 신호**.
   *
   * 링크 복사는 "괜찮네" 지만 인쇄는 **오늘 수업에 쓰겠다**는 뜻이다. 그리고 그 종이는
   * 교무실에 남아 다음 교사에게 간다 — CAC 0 채널에서 브랜드가 옮겨 다니는 실물 경로다.
   * 어떤 표에도 흔적이 남지 않는다(인쇄는 브라우저에서 끝난다). 파생으로 대체할 수 없다.
   */
  | { name: 'fit_worksheet_printed'; props: { mode: 'list' | 'quiz' | 'both'; words: number } }
  /**
   * 칠해진 지문 위에서 학년을 옮겼다 — `/fit` 의 서명(2026-09-19 발산 A). 랜딩의 `landing_demo_moved`
   * 와 같은 몸짓이 도구에서도 쓰이는지를 잰다. 드래그 중 매번이 아니라 멈춘 뒤 한 번.
   */
  | { name: 'fit_level_moved'; props: { level: LevelValue } }
  /**
   * 「학급에 나눠 줄 한 장으로」 를 펼쳤다(발산 B — 출력 면). 인쇄(`fit_worksheet_printed`) 의 앞 단계다.
   * `words` 는 난외 풀이 낱말 수(숫자) — 지문은 싣지 않는다.
   */
  | { name: 'fit_sheet_opened'; props: { words: number } }
  /**
   * 랜딩 진입 — 검색·공유가 도착하는 지점의 분모.
   *
   * 2026-08-26 이전 이 자리는 개발용 화면 인덱스였고 랜딩 자체가 없었다. 이제 sitemap 의
   * 132개 URL 이 여기로 오므로, 여기를 못 세면 **검색이 실제로 사람을 데려오는지** 알 수 없다.
   */
  | { name: 'landing_viewed'; props: Record<string, never> }
  /**
   * 랜딩에서 다음으로 넘어간 클릭.
   *
   * `fit` 은 `fit_viewed` 와 대조해 **랜딩→진단 이탈**을 본다(두 수가 벌어지면 그 사이가 샌다).
   * `signup` 은 가치를 보기 전에 바로 가입한 사람이라 `fit_signup_clicked` 와 다른 사람이다.
   */
  | { name: 'landing_cta_clicked'; props: { target: 'fit' | 'signup' } }
  /**
   * 공용 단어장 서가 진입 — **선택 퍼널의 분모**.
   *
   * 2026-08-31 실측: 이 서가를 브랜딩(표지·판권면·목차·사다리)했지만 **그것이 선택을
   * 바꿨는지 알 방법이 없었다.** 구독은 `user_word_set_subscriptions` 에서 파생되지만
   * "서가에 왔다" 와 "한 권을 열어 봤다" 는 **어떤 테이블에도 흔적이 남지 않는다.**
   * 분모가 없으면 전환율이 없고, 전환율이 없으면 브랜딩의 효과는 영원히 의견이다.
   *
   * ⚠️ 파생 가능한 것은 수집하지 않는다(`lib/admin/retention-math.ts` 의 결정).
   *   그래서 구독 완료 이벤트는 **일부러 없다** — 그 행은 DB 에 남는다.
   */
  | { name: 'catalog_viewed'; props: { volumes: number } }
  /**
   * 한 권을 열어 봤다 — 표지·제목이 **고르게 만들었는가**의 직접 신호.
   *
   * `step` 은 그 권의 사다리 계단(학령 밖이면 null)이고, `hasCover` 는 도판 유무다.
   * 둘을 함께 보면 "표지가 있는 권이 더 열리는가" 를 **관측으로** 답할 수 있다 —
   * 지금은 그 질문에 아무도 답할 수 없다.
   */
  | { name: 'volume_previewed'; props: { step: number | null; hasCover: boolean } }
  /**
   * 히어로 데모의 레벨 슬라이더를 움직였다 — **랜딩 안에서 처음으로 셀 수 있는 행동.**
   *
   * 지금까지 랜딩은 `landing_viewed`(들어옴)와 `landing_cta_clicked`(나감) 두 끝점만 셌다.
   * 그 사이가 비어 있으면 이탈이 **어디서** 나는지 영원히 모른다 — "왔다 갔다" 만 안다.
   * 이 이벤트가 있으면 세 부류가 갈린다: 만져 보지도 않고 나간 사람 / 만져 보고 나간 사람 /
   * 만져 보고 다음으로 간 사람. 증명(§🎯 I3)이 실제로 작동하는지의 유일한 관측이다.
   *
   * ⚠️ 드래그마다 보내지 않는다 — 화면이 600ms 디바운스한다.
   */
  | { name: 'landing_demo_moved'; props: { level: LevelValue } }
  /**
   * 랜딩의 한 구획까지 스크롤이 닿았다 — **이탈 깊이**.
   *
   * 구획 이름은 닫힌 열거형이다(자유 문자열 금지 — 이 파일의 계약). 구획을 늘리거나
   * 이름을 바꾸면 여기도 같은 커밋에서 바꾼다. 안 그러면 `track()` 이 조용히 버린다.
   */
  | { name: 'landing_section_reached'; props: { section: 'demo' | 'differentiators' | 'doors' } }
  /**
   * 셸의 「나의 자리」 패널을 폈다 — **셸 두 번째 층이 실제로 쓰이는가.**
   *
   * 이 파일은 원래 공개 퍼널용이지만, 이 둘은 같은 계약(숫자·불리언·닫힌 열거형)을 지키고
   * 같은 이유로 필요하다: **안 재면 새로 만든 층이 쓰이는지 영원히 모른다**(§E).
   * 학습자 화면이라 지문이 섞일 여지가 없다 — 속성은 국면과 개수뿐이다.
   */
  | {
      name: 'wayfinder_opened'
      props: { phase: 'undiagnosed' | 'ready' | 'moving' | 'complete'; steps: number }
    }
  /**
   * 셸의 단 하나뿐인 CTA 를 눌렀다 — 띠가 **행동으로 이어지는가**.
   *
   * 이전 띠에는 이 관측이 없었다. 그래서 "상단 6%가 무엇을 하고 있는가" 라는 질문에
   * 아무도 답할 수 없었고, 실제로 아무것도 하고 있지 않았다(2026-09-05 실측).
   */
  | {
      name: 'wayfinder_cta_clicked'
      props: { phase: 'undiagnosed' | 'ready' | 'moving' | 'complete'; done: number }
    }
  /**
   * `/hub` 「오늘 다시 볼 단어」 슬라이더를 옮겼다(2026-09-19 재설계 — 발산 A 「들어 올리는 곡선」).
   * 허브의 서명(오늘 N개를 보면 7일 곡선이 들어 올려진다)이 쓰이는지를 재는 유일한 관측이다.
   * 드래그 중 매번이 아니라 멈춘 뒤 한 번. `count` = 고른 수 · `words` = 슬라이더 최대 — 둘 다 숫자, 낱말은 싣지 않는다.
   * DB 허용 목록은 승인 대기(`supabase/migrations/_pending_funnel_allow_hub_curve.sql`) — 적용 전에는 DB 가 거부한다.
   */
  | { name: 'hub_curve_interacted'; props: { count: number; words: number } }
  /**
   * `/dashboard` 「기억의 지층」에서 층 하나를 펼쳤다(2026-09-19 재설계 — DD-29). 접을 때는 보내지 않는다.
   * `rung` = 층(닫힌 열거형) · `words` = 그 층의 낱말 수. 낱말은 싣지 않는다.
   * 회고의 서명(층 안의 내 낱말)이 쓰이는지 재는 유일한 관측 — 진입은 screen_viewed(dashboard)가 센다.
   * DB 허용 목록은 승인 대기(`supabase/migrations/_pending_funnel_allow_hub_curve.sql` 에 한 줄 더함).
   */
  | {
      name: 'retrospect_layer_opened'
      props: { rung: 'day' | 'few' | 'week' | 'month' | 'season'; words: number }
    }
  // 은퇴(2026-09-17) — `csat_overlay_loaded` · `_located` · `_answered` · `_revealed` ·
  // `csat_drill_answered` · `_finished`. 보내던 화면(`/csat/overlay` · `/csat/drill`)을 학습자 재설계로
  // 걷었다(docs/csat-learner/DECISIONS.md D8). 같은 질문은 `csat_paper_read` · `csat_session_*` 이 받는다.
  // DB 허용 목록에는 남긴다 — 이미 쌓인 행을 읽는 대시보드가 이름을 안다.
  /**
   * 해설 화면에서 **강의를 틀었다** — 한 화면 방문에 한 번(처음 재생)만 보낸다.
   *
   * 이 기능의 전제는 «읽기보다 들으며 짚기가 낫다» 인데, 그 전제는 **틀었는가**부터 확인해야 한다.
   * `mode` 는 소리가 났는지(목소리 없는 기기는 하이라이트만 진행한다), `from` 은 어디서
   * 시작했는지(재생 단추 · 눈금 · 설명 블록), `rate` 는 고른 속도(×100).
   */
  | {
      name: 'csat_lecture_played'
      props: { mode: 'voice' | 'silent'; from: 'start' | 'cue' | 'block'; rate: 90 | 100 | 115 }
    }
  /**
   * 강의를 **끝까지** 들었다 — 완주율의 분자. `jumps` 는 건너뛴 횟수 — 많으면 강의가 길거나
   * 이미 아는 부분이 많았다는 뜻이고, 0 이면 처음부터 끝까지 흘려들은 것이다.
   */
  | {
      name: 'csat_lecture_ended'
      props: { cues: number; jumps: number; mode: 'voice' | 'silent' }
    }
  /**
   * **학습자 세션 루프(2026-09-17 · docs/csat-learner-brief.md).** 진입은 `screen_viewed`
   * (csat · csat-session · csat-progress)가 센다. 여기는 루프 안에서 무슨 일이 있었는지다.
   *
   * `started` — [시작]을 눌렀다. `cached` 는 그 세션에 필요한 회차 중 기기에 이미 있던 수 —
   *   0 이 많으면 「받기/놓기」가 시작의 문턱이라는 뜻이다(F1 의 전제).
   */
  | {
      name: 'csat_session_started'
      props: { size: number; review: boolean; needed: number; cached: number }
    }
  /** 한 문항에 답했다(또는 고르지 않고 넘겼다). `sec` 는 반올림한 초. */
  | {
      name: 'csat_session_answered'
      props: { seq: number; correct: boolean; skipped: boolean; sec: number; review: boolean }
    }
  /**
   * ② 이해 단계에서 무엇을 열었나 — 인라인 설명이 실제로 쓰이는지의 유일한 관측.
   * 한 번도 안 열리면 「문장을 탭하면 설명」이 발견되지 않는다는 뜻이다.
   */
  | {
      name: 'csat_session_explained'
      props: { kind: 'evidence' | 'reject' | 'tempt' | 'more' | 'lecture' }
    }
  /** ③ 한 줄 — [알겠어요] / [헷갈려요]. 정답인데 헷갈린 수가 메타인지 신호다. */
  | {
      name: 'csat_session_marked'
      props: { seq: number; confused: boolean; correct: boolean }
    }
  /** 세션을 끝까지 돌았다 — 완주율의 분자. */
  | {
      name: 'csat_session_finished'
      props: { total: number; correct: number; confused: number; seconds: number }
    }
  /**
   * 문제지를 읽었다. `known` 은 해시가 색인에 있었나, `failed` 는 글로 못 뽑아 **종이 그대로**
   * 보여 줘야 하는 문항 수 — 이것이 reflow 실패율이다(지시문 C6 · 관리자 evidence 쪽 수신처).
   */
  | {
      name: 'csat_paper_read'
      props: { known: boolean; items: number; failed: number; chosen: boolean }
    }
  /**
   * 기출 해설에서 근거 하나를 열었다 — **「클릭/클릭/클릭」이 실제로 일어나는가.**
   *
   * 이 화면의 전제는 «근거를 눌러 가며 지문 위에서 풀이를 재구성한다» 인데, 그 전제가
   * 맞는지는 **몇 개를 여는지**로만 알 수 있다. `seq` 가 1에서 멈추면 지도는 열어 본
   * 장식이고, 3~4 로 이어지면 설계가 작동하는 것이다. 진입은 `screen_viewed`(csat-item)가
   * 이미 세므로 여기서 또 세지 않는다 — 분모가 갈린다.
   *
   * ⚠️ **첫 근거는 안 센다.** 서버 렌더가 정답 근거를 이미 펴 둔 채 오므로(클릭 0으로
   *    증명이 보이게 한 설계) 그걸 세면 모든 방문이 최소 1이 되어 «눌렀다» 와 «떠 있었다» 가
   *    구별되지 않는다.
   *
   * `found` 는 그 근거의 위치를 지문에서 찾았는가다 — 거짓이 늘면 앵커 추출이 나빠진 것이고,
   * 학습자에게는 「위치 없음」으로 보인다.
   */
  | {
      name: 'csat_evidence_opened'
      props: { kind: 'answer' | 'reject'; found: boolean; seq: number }
    }
  /**
   * 오답 지도(`/csat` 히어로)의 범위를 바꿨다 — 유형 칩 또는 「최근 4개년만」.
   *
   * 이 화면의 주장은 «오답은 아홉 가지로 수렴한다» 이고, 그 주장이 학습자에게 **자기 것으로**
   * 넘어갔는지는 «범위를 바꿔 봤는가» 로만 알 수 있다(I3 — 값을 바꾸면 결과가 바뀐다).
   * 진입은 `screen_viewed`(csat) 가 이미 세므로 여기서 또 세지 않는다 — 분모가 갈린다.
   *
   * ⚠️ 유형 id 는 **보내지 않는다.** 26개짜리 닫힌 목록이라 보낼 수는 있지만, 이 이벤트로
   *    답하려는 질문은 «어느 유형인가» 가 아니라 «조작했는가» 다. 유형별 관심은 유형 화면의
   *    `screen_viewed` 가 이미 말한다.
   */
  | {
      name: 'csat_atlas_scoped'
      props: {
        /** 유형을 골랐나(거짓이면 「전체」로 되돌린 것) */
        scoped: boolean
        /** 「최근 4개년만」이 켜져 있나 */
        recentOnly: boolean
        /** 그 범위에서 이름이 붙은 함정 가짓수 — 범위를 좁힐수록 준다 */
        kinds: number
      }
    }
  /**
   * 함정 한 줄을 펴서 **실제 기출 예시**까지 봤다 — 「세었다」에서 「납득했다」로 넘어가는 자리.
   *
   * `rank` 가 계속 1~2 에 몰리면 학습자는 큰 막대만 누르는 것이고, 지도는 순위표로만 읽힌 것이다.
   * `seq` 가 1에서 멈추면 하나 열고 떠난 것이다(같은 이유로 `csat_evidence_opened` 도 센다).
   */
  | {
      name: 'csat_trap_opened'
      props: {
        /** 지금 보이는 목록에서 몇 번째 줄인가 (1-기반) */
        rank: number
        /** 유형을 가로지르는 함정인가 */
        universal: boolean
        /** 유형으로 좁힌 상태에서 열었나 */
        scoped: boolean
        /** 이 방문에서 몇 번째로 편 것인가 */
        seq: number
      }
    }
  /**
   * 한 회차 계획의 **줄 세우는 기준**을 바꿨다 — ⑤ 주파가 실제로 쓰이는가.
   *
   * 「내 약한 것 먼저」는 기록이 문턱을 넘은 사람에게만 보인다. 그 사람들이 실제로 눌러
   * 보는지가 이 이벤트로만 관측된다 — 한 번도 안 눌리면 순서는 만들어 두고 아무도 안 쓰는
   * 기능이고, 그건 훈련 기록을 쌓게 한 이유가 사라졌다는 뜻이다.
   */
  | {
      name: 'csat_plan_ordered'
      props: {
        /** 「내 약한 것 먼저」로 바꿨나(거짓이면 시험 순서로 되돌린 것) */
        weak: boolean
        /** 줄 수 — 회차가 바뀌면 달라진다 */
        rows: number
      }
    }
  /**
   * 한 회차 계획의 **읽기 속도**를 바꿨다 — 「이 계획이 내 것이 됐는가」의 유일한 신호.
   *
   * 이 화면은 두 숫자(합계·쓸 수 있는 시간)만 적던 자리였다. 띠와 배율을 넣은 이유는
   * 학습자가 **자기 속도로 다시 그려 보게** 하려는 것인데, 그게 실제로 일어나는지는
   * 이 이벤트로만 안다. 한 번도 안 눌리면 띠는 읽고 지나가는 그림이다.
   *
   * `overSec` 은 그 배율에서 얼마나 초과하는지다 — 절차가 무거운지(= 우리 쪽 문제인지)를
   * 재는 값이라 분석 쪽 결정에 쓰인다. 자유 문자열은 없다.
   */
  | {
      name: 'csat_plan_speed_set'
      props: {
        /** 고른 배율 × 100 (80 · 100 · 125) */
        speed: number
        /** 그 배율에서 시험 시간을 넘는 초. 안 넘으면 0 */
        overSec: number
        /** 넘는가 */
        breaks: boolean
      }
    }
  /**
   * 학습자 화면 진입 — **모든 로그인 화면의 분모** (CLAUDE.md D2).
   *
   * 2026-09-05 실측: 학습자 화면 77개 중 진입 이벤트를 가진 화면이 **0개**였다. 위 14개는
   * 전부 공개 퍼널·셸 패널의 것이라, 로그인한 학습자가 어느 화면에서 머물고 어디서 새는지를
   * 아무 표도 말해 주지 않았다. 화면마다 손으로 심으면 반드시 빠지므로(지금까지 그랬다)
   * **셸 한 곳**(`components/layout/ScreenViewTracker.tsx`)이 경로 변경을 듣고 한 번 보낸다.
   *
   * `screen` 은 자유 문자열이 아니다 — `lib/framework/learner-routes.ts` 의 `SCREEN_IDS`
   * (닫힌 목록 · 동적 세그먼트는 `text-workspace` 처럼 접힌 이름)이고, 목록 밖이면 `'other'`.
   * 경로 원문·id·쿼리는 실리지 않는다. 회귀가 모든 id 가 `isSafeProps` 를 넘는지 검사한다.
   */
  | {
      name: 'screen_viewed'
      props: {
        /** `SCREEN_IDS` 의 값 또는 `'other'` */
        screen: string
        group: 'main' | 'app'
        /** 목록에 있는 화면인가 — `'other'` 비율이 오르면 레지스트리가 낡은 것이다 */
        known: boolean
      }
    }


  /**
   * 구성요소 영상 재생 시작 — **영상이 실제로 보이는지**의 분모.
   *
   * 영상 공장(`packages/video-factory`)이 141개를 찍어 낼 수 있어도, **본 사람이 0 이면
   * 공급을 늘린 것일 뿐**이다(§D 공급/수요 게이트). 그래서 만든 수가 아니라 **본 수**를 센다.
   * 속성에 영상 id 를 넣지 않는 이유는 이 파일의 계약 때문이다 — id 는 자유 문자열에 가깝고
   * 앞으로 늘어난다. `kind` 는 닫힌 목록이고, 그것으로 "어떤 종류가 보이는가" 는 답할 수 있다.
   */
  | {
      name: 'video_started'
      props: {
        // 영상 종류 — `lib/video/catalog.ts` 의 `KIND_LABEL` 과 같은 목록이어야 한다.
        //   이 파일은 일부러 아무것도 import 하지 않는다(분석 계약이 홀로 서야 하므로).
        //   그래서 회귀 `video-kind-contract.test.ts` 가 두 목록을 맞대 본다 — 손으로 맞추다
        //   빠뜨리면 그 종류의 재생이 **조용히 버려진다**(수신부가 실패해도 204를 준다).
        kind:
          | 'intro'
          | 'benefit'
          | 'curriculum'
          | 'series'
          | 'type'
          | 'module'
          | 'method'
          | 'advice'
        format: 'wide' | 'vertical' | 'square'
        /** 영상 길이(초). 짧은 것이 더 끝까지 보이는지 보려면 필요하다 */
        seconds: number
        /**
         * 영상 id — `manifest.json` 의 닫힌 목록. 목록 밖이면 `'other'`.
         *
         * 자유 문자열 금지 계약의 예외가 아니다 — `screen_viewed.screen` 과 같은 모양이다
         * (우리가 지은 슬러그 · 레지스트리에 실재 · 사용자 입력이 한 글자도 안 섞인다).
         * 이게 없으면 **어떤 영상이 먹히는지 영원히 모른다** — 종류별 합계만으로는
         * 62편 중 무엇을 더 만들지 못 정한다.
         */
        videoId: string
      }
    }
  /**
   * 영상을 끝까지 봤다 — **완주율**. 시작만 세면 "틀어 놓고 나갔다" 와 구분이 안 된다.
   */
  | {
      name: 'video_completed'
      props: {
        // 영상 종류 — `lib/video/catalog.ts` 의 `KIND_LABEL` 과 같은 목록이어야 한다.
        //   이 파일은 일부러 아무것도 import 하지 않는다(분석 계약이 홀로 서야 하므로).
        //   그래서 회귀 `video-kind-contract.test.ts` 가 두 목록을 맞대 본다 — 손으로 맞추다
        //   빠뜨리면 그 종류의 재생이 **조용히 버려진다**(수신부가 실패해도 204를 준다).
        kind:
          | 'intro'
          | 'benefit'
          | 'curriculum'
          | 'series'
          | 'type'
          | 'module'
          | 'method'
          | 'advice'
        format: 'wide' | 'vertical' | 'square'
        seconds: number
        /**
         * 영상 id — `manifest.json` 의 닫힌 목록. 목록 밖이면 `'other'`.
         *
         * 자유 문자열 금지 계약의 예외가 아니다 — `screen_viewed.screen` 과 같은 모양이다
         * (우리가 지은 슬러그 · 레지스트리에 실재 · 사용자 입력이 한 글자도 안 섞인다).
         * 이게 없으면 **어떤 영상이 먹히는지 영원히 모른다** — 종류별 합계만으로는
         * 62편 중 무엇을 더 만들지 못 정한다.
         */
        videoId: string
      }
    }

export type PublicEventName = PublicEvent['name']

/**
 * 허용 이벤트 이름 — 런타임 검사용(타입은 빌드 후 사라진다).
 *
 * ⚠️ **`Record<PublicEventName, true>` 로 적는다. 배열 리터럴로 적지 않는다.**
 *    `readonly PublicEventName[]` 는 **빠진 이름을 잡아 주지 않는다** — 배열은 전수를
 *    요구하지 않기 때문이다. 그래서 유니온에는 있는데 이 목록에는 없는 이벤트가 생기고,
 *    `track()` 은 목록에 없으면 **조용히 버린다**(운영 빌드에서는 console.error 도 안 나온다).
 *
 *    2026-08-30 실측으로 실제로 그 일이 있었다 — `fit_worksheet_printed` 가 유니온에만 있고
 *    이 목록에 없어 **한 건도 전송되지 않고 있었다.** 하필 이 파일이 스스로 그 이벤트를
 *    "가입보다 강한 의도 신호" 라고 적어 둔, 교사 채널(CAC 0)의 핵심 신호다.
 *
 *    Record 로 적으면 이름을 하나라도 빠뜨렸을 때 **타입 검사가 막는다.**
 */
const EVENT_REGISTRY: Record<PublicEventName, true> = {
  fit_viewed: true,
  fit_analyzed: true,
  fit_shared: true,
  fit_share_opened: true,
  fit_signup_clicked: true,
  fit_worksheet_printed: true,
  fit_level_moved: true,
  fit_sheet_opened: true,
  landing_viewed: true,
  landing_cta_clicked: true,
  catalog_viewed: true,
  volume_previewed: true,
  landing_demo_moved: true,
  landing_section_reached: true,
  wayfinder_opened: true,
  wayfinder_cta_clicked: true,
  hub_curve_interacted: true,
  retrospect_layer_opened: true,
  csat_evidence_opened: true,
  csat_atlas_scoped: true,
  csat_plan_speed_set: true,
  csat_plan_ordered: true,
  csat_trap_opened: true,
  csat_lecture_played: true,
  csat_lecture_ended: true,
  csat_session_started: true,
  csat_session_answered: true,
  csat_session_explained: true,
  csat_session_marked: true,
  csat_session_finished: true,
  csat_paper_read: true,
  screen_viewed: true,
  video_started: true,
  video_completed: true,
}

export const ALLOWED_EVENTS: readonly PublicEventName[] = Object.keys(
  EVENT_REGISTRY,
) as PublicEventName[]

/** 러닝 워드 수 → 버킷. 원본 숫자를 그대로 보내지 않는 이유는 필요하지 않기 때문이다. */
export function sizeBucket(totalTokens: number): 'xs' | 's' | 'm' | 'l' | 'xl' {
  if (totalTokens < 150) return 'xs'
  if (totalTokens < 400) return 's'
  if (totalTokens < 900) return 'm'
  if (totalTokens < 2000) return 'l'
  return 'xl'
}

/** 해석률 → 10% 단위 정수(0~10). */
export function resolvedDecile(resolvedShare: number): number {
  if (!Number.isFinite(resolvedShare)) return 0
  return Math.max(0, Math.min(10, Math.round(resolvedShare * 10)))
}

/**
 * 속성이 전송해도 되는 형태인지 확인한다 — **마지막 방어선**.
 *
 * 타입은 빌드 후 사라지므로, 실수로 문자열이 섞여 들어오면 런타임에는 아무도 안 막는다.
 * 여기서 값의 **종류**를 검사한다: 숫자·불리언·null 은 통과, 문자열은 **짧은 열거형만** 통과.
 * 지문 조각은 반드시 길거나 공백을 포함하므로 이 검사에 걸린다.
 */
export function isSafeProps(props: unknown): boolean {
  if (props === null || typeof props !== 'object' || Array.isArray(props)) return false

  // ⚠️ 예전에는 `Object.values` 만 봤다 — **키 이름과 개수는 아무도 안 봤다.**
  //    그래서 4MB 짜리 키 하나를 실어 보내면 값 검사를 통과하고 그대로 jsonb 에 저장됐다.
  //    이 라우트는 가드가 없는 공개 쓰기 경로라 키도 값과 같은 기준으로 막아야 한다.
  //    실제 이벤트의 속성은 3~5개이고 이름은 `resolved_decile` 처럼 짧다.
  const keys = Object.keys(props as Record<string, unknown>)
  if (keys.length > 12) return false
  for (const key of keys) {
    if (key.length > 40 || /\s/.test(key)) return false
  }

  for (const value of Object.values(props as Record<string, unknown>)) {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') continue
    if (typeof value === 'string') {
      // 열거형 값만 허용 — 24자 이내 · 공백 없음. 지문 조각은 둘 중 하나에 반드시 걸린다.
      if (value.length <= 24 && !/\s/.test(value)) continue
      return false
    }
    return false
  }
  return true
}
