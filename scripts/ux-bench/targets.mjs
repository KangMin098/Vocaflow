// scripts/ux-bench/targets.mjs
//
// **비교 대상 — 국내외 대표 학습 플랫폼의 "학습자가 실제로 보는" 공개 화면.**
//
// ── 고르는 기준 ──────────────────────────────────────────────────────
// ① 학습자 표면일 것 — 회사 소개나 채용 페이지는 학습 화면이 아니다.
// ② 로그인 없이 열릴 것 — 로그인 뒤 화면은 우리가 잴 방법이 없다.
//    **이 한계를 숨기지 않는다**: 아래 목록은 각 플랫폼의 *공개* 표면이고,
//    로그인 뒤 학습 화면은 더 좋을 수도 나쁠 수도 있다. 리포트에 함께 적는다.
// ③ 국내 3 + 해외 3 이상 — "국내외 대표" 라는 목표어를 지키려면 양쪽이 필요하다.
//
// 실패(403·타임아웃)한 대상은 **점수 0 이 아니라 분모에서 뺀다.** 못 잰 것을
// 나쁜 점수로 바꾸면 우리 우위가 측정이 아니라 그쪽 봇 차단에서 나온다.

export const COMPETITORS = [
  // ── 해외 ──
  { platform: 'Quizlet', region: 'global', url: 'https://quizlet.com/kr', what: '한국어 랜딩/학습 진입' },
  { platform: 'Quizlet', region: 'global', url: 'https://quizlet.com/kr/subject/toeic/', what: '주제별 학습 세트 목록' },
  { platform: 'Duolingo', region: 'global', url: 'https://www.duolingo.com/', what: '학습 진입' },
  { platform: 'Duolingo', region: 'global', url: 'https://www.duolingo.com/learn', what: '학습 트리(비로그인 표면)' },
  { platform: 'Vocabulary.com', region: 'global', url: 'https://www.vocabulary.com/lists/', what: '단어 목록 카탈로그' },
  { platform: 'Vocabulary.com', region: 'global', url: 'https://www.vocabulary.com/dictionary/abundant', what: '낱말 상세(사전 표면)' },
  { platform: 'Memrise', region: 'global', url: 'https://www.memrise.com/', what: '학습 진입' },
  { platform: 'Busuu', region: 'global', url: 'https://www.busuu.com/en', what: '학습 진입' },
  { platform: 'LingQ', region: 'global', url: 'https://app.lingq.com/', what: '학습 앱 진입' },

  // ── 국내 ──
  // ⚠️ 국내 영어학습 서비스는 **앱 전용**이 많아 웹 학습 표면이 적다. 여기 있는 것은
  //    웹에서 실제로 열리는 학습자 표면만이고, 그래서 국내 표본이 해외보다 얇다.
  //    이 얇음은 리포트에 그대로 적는다 — 표본이 얇다는 사실을 숨기고 평균을 내면
  //    "국내 대비 우위" 라는 말이 근거 없이 커진다.
  { platform: '클래스카드', region: 'kr', url: 'https://www.classcard.net/', what: '학습 진입' },
  { platform: '클래스카드', region: 'kr', url: 'https://b.classcard.net/', what: '학습 진입(교사/학급)' },
  { platform: '스픽', region: 'kr', url: 'https://www.speak.com/ko', what: '학습 진입' },
  { platform: '케이크', region: 'kr', url: 'https://cake.day/', what: '학습 진입' },
  { platform: '띵커벨', region: 'kr', url: 'https://tkbell.co.kr/', what: '학습 활동 카탈로그' },
  { platform: '퀴즈앤', region: 'kr', url: 'https://www.quizn.show/', what: '학습 활동 카탈로그' },
  { platform: 'YBM클래스', region: 'kr', url: 'https://www.ybmclass.com/', what: '학습 카탈로그' },
];

/** 뷰포트 — 우리 스윕과 **같은 두 크기**. 다른 크기로 재면 비교가 성립하지 않는다. */
export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];
