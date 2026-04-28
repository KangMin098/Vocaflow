# docs/references — HTML 레퍼런스

루트 `CLAUDE.md` §독립 레퍼런스 HTML 파일 참조. 각 파일은 React 구현 시 CSS 변수명·클래스 구조·애니메이션·로직의 시각적 기준이다.

| 파일 | 역할 |
|------|------|
| `ELA_PartsKit_v05.html` | Parts Kit 시각 레퍼런스 (Quizlet Parts Kit v06 분석 결과 반영) |
| `Flashcard.html` | 하늘 환경 / 구름 / 잔디 / 레인보우 로고 / CSS 3D flip / 양방향 모드 |
| `SpellForge.html` | 파란 패널 / 전구 힌트 바 / JetBrains Mono 셀 / 파티클 / 자동 입력 |
| `WordBlitz_Jungle.html` | 정글 테마 / SVG 크리처 4종 / Fredoka One / 파티클 / 콤보 |
| `ScriptQuiz.html` | Little Fox 스타일 / O/X 피드백 / 원문 하이라이트 / SVG 점수 링 |
| `TextViewer_v3.html` | 원문 입력 + Step 듣기 + TTS 컨트롤 (보충 레퍼런스) |
| `Dashboard_Web.html` | StatCard / WeeklyHeatmap / AccuracyRing / 추세 (보충 레퍼런스) |

> 레퍼런스 HTML 파일 내 `CLAUDE_v4.md` 등 구버전 언급은 모두 루트 `CLAUDE.md` 로 간주.

## marketing/ — 랜딩·인증 프로토타입

`apps/web/src/app/(marketing)/` + `(auth)/` 구현 시 시각·동작 레퍼런스. 정적 HTML 셋이며 자체 토큰(`shared/tokens.css`)을 사용한다 — 이 토큰은 `packages/design-tokens` 의 SSoT 와 **별개의 축약형**(`--ph`/`--pl`/`--pd` vs SSoT의 `--p-hover`/`--p-light`/`--p-dark`)을 사용하므로, React 포팅 시 SSoT 변수명으로 재매핑 필요.

```
marketing/
├── pages/
│   ├── Landing.html      랜딩 (히어로·how·features·reviews·pricing·faq·final CTA)
│   ├── Login.html        로그인 + 4주 학습 히트맵 사이드 패널
│   ├── Signup.html       회원가입 + 약관 동의 + 비밀번호 강도 미터
│   ├── landing.css       Landing 전용 스타일
│   └── landing.js        Landing 전용 스크립트 (스크롤·카운트업·FAQ·요금 토글)
└── shared/
    ├── tokens.css        디자인 토큰 (자체 축약형 — SSoT 와 매핑 필요)
    ├── nav.css / nav.js  공통 네비게이션
    └── footer.css / footer.js  공통 푸터
```

> **⚠️ 인코딩 주의**: 이 마케팅 프로토타입의 한글 본문은 더블 인코딩(UTF-8 → Latin-1 → UTF-8) 손상 상태로 들어왔다. 헤더 데코레이션(`═══`)·브랜드명(LexiVault → Vocaflow / 단어장 모듈만 WordVault)·구분자(` — `, ` · `) 는 `scripts/marketing-ref-transform.mjs` 로 일괄 보정됐으나, 본문 한글 문자열은 일부 control byte(0x80–0x9F)가 복사 과정에서 누락돼 무손실 복구가 불가능하므로 수기 정리 중이다.
