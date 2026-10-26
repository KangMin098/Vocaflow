# LCP Story S7 — 파일럿 원천 준비 기록

> 작성 2026-10-25 · 등록 작업 T-0169(LCP Story — S7 준비) · 정본 [../LCP_STORY.md](../LCP_STORY.md) · 단계 지시 [IMPLEMENTATION.md S7](./IMPLEMENTATION.md)
> 상태: **`PILOT_NOT_RUN`** — 실제 참가자가 없다. 원천 준비와 후속 대표 1편의 AI 독립 검수 · 실제 dev 초안/검수 등록 · 인증 화면 검증을 구분한 기록이다.
> 기술·화면 검사는 학습 효과의 근거가 아니다. 합성 워크스루도 화면 · 인터페이스 점검일 뿐이다(정본 §19).

## 0. 이번 회차에서 한 일과 하지 않은 일

### 2026-10-26 후속 — 대표 Story 1편 제작·AI 독립 검수

아래 2026-10-25 준비 기록을 보존하고, 이번에는 기존 `blue-carbuncle-r1/story-b2`만 제작했다. 원천·정책을 보존하고 다른 작품/쉬운 판을 추가하지 않았다. 후속 관리자 조회 보완과 실제 dev 등록 검증은 아래에 별도로 기록한다. Claude Code의 기존 세션 `25e83007-cf44-4c42-9750-16d5a98a9764`가 실제 exit 0으로 종료했으며, 제작에 참여하지 않은 Codex 세션 `01a1725e-7462-7cc1-9bfd-b5af519f5442`가 원문 214문단·16독서 단위·변경 기록 90개·활동 3개를 전량 대조했다. 주석의 추론/사실 구분과 호출 벨 표현 3건을 보완한 최종 판을 다시 결속했다.

| 구분 | 실제 상태 |
|---|---|
| 판본 | `work/lcp-story-pilot/export/blue-carbuncle-r1/story-b2.edition.out.json`, raw SHA-256 `a94d9c5f370054e7f72ea01480c013b808499a785735ba10e539e34c11d805a7` |
| 독립 검수 | `story-b2.review-6859c0e19252.out.json`, SHA-256 `0b5813da9d39b7aad0ac2789753c21e5a33144ec23d461ec18636df122e43b7e`; `ai_model/ai_review`, approve, 필수 10항목 통과, 결속 current |
| 기술 검증 | 판본별 valid·오류 0. 전체 CLI exit 2는 의도적으로 미제작한 `easy-b1` 때문이며 전체 성공으로 표시하지 않는다 |
| 발행 계획 | 대표 판본은 `rights_unconfirmed:source_text`로 hold. 후속 정상 인증 UI로 dev 초안·AI 독립 검수 등록 완료. 권리 결정·발행은 미실행 |
| 콘텐츠 판단 | 원작 단서·거위 이동 경로·누명·자비의 근거 보존을 AI가 검수했다. B2는 편집 목표이며 실제 학습자 적합성 진단이 아니다. 동물 위해·도축·폭력 과거사와 시대적 편견이 있어 전 연령용/비폭력으로 표시하지 않는다 |
| UX·교육 효과 | 실제 발행본으로 인증된 PC1440/1280 전체 여정은 미검증. 참가자·새 글 독립 평가가 없으므로 `PILOT_NOT_RUN`·`EDUCATION_EFFECT_UNVERIFIED` 유지 |

검수 AI 배정은 중앙 `development_policy.ai_work_roles`에 따라 자동 수행한다. 현재 SQL은 AI 검수를 이미 허용하며 서로 다른 활성 스태프 UID와 제작·검수 세션을 요구한다. 이는 별도 실제 사람의 콘텐츠 검수를 요구한다는 뜻이 아니다. 기존 정본 §14의 사람 권리 확인 조건은 별도로 미충족이며 AI 조사나 개발 로그인으로 충족했다고 기록하지 않는다.

### 2026-10-26 후속 — 승인된 개발 인증 계정 구성

사용자가 AI 제작 curator · AI 검수 admin · 일반 학습자 A/B의 신규 4개 계정과 정확한 역할 SQL 적용을 승인했다. 정상 Auth Admin API 생성 후 승인 SHA `0fe31cfd2ee1643be5cab0dcc666fab8c2d196ffb4d968560cd0f1643b18a0f4`(2,308바이트)를 MCP로 적용했다. [SQL 원문·복구안·경계](../../scripts/db/lcp-story-s3/dev-accounts/README.md)를 보존하며 복구는 실행하지 않았다.

- 서로 다른 신규 UID 4개, 요청한 역할·active 상태, 보호된 `app_metadata`의 개발 AI 표기와 `human_review:false`를 확인했다. 비밀값은 Git 제외 `.env*`에만 보관한다.
- 원래 86개 Auth·프로필 지문은 적용 전후 및 독립 사후 SELECT에서 일치했다. 적용 직후 총계 90/90 뒤 다른 cohort 계정 1개가 추가된 91/91 관찰은 이번 4개 생성과 분리한다.
- 정상 비밀번호 로그인 → 새 SSR 쿠키 `getUser()` → 실제 사용자/프로필 일치 → 스태프 RPC 허용·일반 사용자/익명 거부 → A 로그아웃 후 B 로그인, 23/23 통과. 서비스 키·가짜 JWT로 로그인하지 않았다.
- 실제 Chromium에서 4개 계정의 정상 로그인·새로고침·권한별 이동·학습자 관리자 거부·A 로그아웃 후 B 로그인과 1440/1280 빈 서가를 확인했다. 이 빈 서가 전환은 개인 진도·지연 응답 격리의 양성 검증이 아니다.
- 실제 Next의 읽기 Server Action과 History URL 변경 사이 경합으로 파일 패널/선택 상태가 사라지는 경로를 보완했다. 초기 목록·번들을 기존 인증·RPC를 쓰는 `no-store` GET으로 옮겨 로컬 main `4294d8f7c`에 통합했다. 범위 단위 186/186, S4 격리 브라우저 7/7, 웹·스크립트 타입과 변경 파일 lint 통과. 기존 S5 검증 소스 86개 지문은 불변이다.
- 보완 뒤 기존 Claude 세션의 좁힌 실제 브라우저 검증은 **15 PASS · 0 FAIL · 5 NOT_RUN**, 테스트와 Claude 실행 모두 종료 코드 0이다. 두 스태프의 파일 검사 각각 통과 3·문제 0·액션 1·선택 유지, 익명/학습자/스태프 GET 실제 401/403/200(없는 판 404), `no-store`, 1440/1280 역할·빈 목록 화면을 확인했다. 기존 전체 실행 실패 이력과 중단된 run6은 그대로 보존하고 새 성공으로 덮지 않았다.
- 통제한 4초의 실제 GET 응답 지연 뒤에도 선택한 파일·패널이 유지됐다. 파일 선택 후 pending은 확인했으나 패널을 여는 순간 pending은 아니었다. 전체 페이지 재로드 0은 React 재마운트 0의 직접 계측으로 표현하지 않는다.
- 실제 발행본 본문·진도 저장·단위 완료·개인 이력·A 지연 응답 차단의 5개 양성 검증은 발행본과 개인 진도가 없어 `NOT_RUN`이다. 실제 독서·완독·이어하기와 교육 효과는 계속 미검증이다.

실행 근거: 로컬 runtime의 `dev-account-auth-verification.json`, `dev-account-browser-result-20261025T181430Z.json`(이전 63 PASS·2 FAIL·2 NOT_RUN), `dev-account-browser-interruption.json`, `dev-account-browser-detached-interruption.json`, `dev-account-browser-narrow-result-20261025T183027Z.json`, `dev-account-browser-feedback-claude-exit.json`, `dev-account-browser-narrow-evidence-20261025T183027Z.json`. 좁힌 실행 검증기 SHA `7447d8d961fbbd0080f97aed518e5b3afa4794c21b52ef54128f90b45ff69a3c`는 실제 결과·독립 검토와 일치한다. root도 실제 파일 검사·관리자·빈 서가 1440/1280 이미지를 직접 확인했다. 실제 인증·화면 검사이며 교육 효과의 증거로 사용하지 않는다.

### 2026-10-26 후속 — 실제 dev 초안·AI 검수 등록

정상 `/login`과 기존 S4 화면으로 제작 curator가 원천 → 편집 기준 → `story-b2` 초안을 등록하고, 다른 인증 admin 계정이 변경하지 않은 기존 Codex 독립 검수 파일을 제출했다. 평가자는 원문·최종 판을 직접 읽은 별도 Codex 세션이며, Claude는 이번 UI 제출의 기술 작업자다. AI 판단을 새로 만들어 승인하거나 사람 검수로 표시하지 않았다.

- 실제 브라우저 **14 PASS · 0 FAIL · 6 NOT_RUN**, 테스트·Claude 실행 모두 exit 0. 새로 읽은 실제 목록·번들로 저장 결과와 현재 결속을 확인했다.
- 별도 MCP SELECT로 원천 1 · 편집 기준 1 · 판본 자리 2 · 실제 판 1 · 검수 1을 확인했다. `easy-b1`은 기존 정책의 미제작 자리일 뿐 실제 각색문은 만들지 않았다.
- 원문 본문 SHA `391413941cedf99977ff340a1f5b49476222c38facd578b0afe2884bb570a129`, 판본 정본 SHA `2faeaa696d5638331f01d291323a8c899f51f20a378640c900072aa40f19d414` 및 16단위가 일치했다. 승인된 producer(curator)/reviewer(admin)·active 상태·서로 다른 실제 UID·`ai_review/ai_model`·approve/qualifies·현재 판/활동/원천 결속을 값 비노출 불리언으로 확인했다.
- 권리 결정 0 · 발행 0. 초안은 학습자 서가에 보이지 않는다. 권리 확인·검증 증인·발행·실제 발행본 독서·사람 검수·실제 참가자 효과 검증은 하지 않았다. 기존 정본 §14의 “권리 확인은 사람이 근거와 함께 기록한다”는 조건을 AI 계정 준비나 이번 AI 검수로 충족했다고 선언하지 않는다.

근거는 runtime의 `dev-account-story-draft-before-raw.json`, `dev-account-story-draft-result-20261025T183708Z.json`, `dev-account-story-draft-after-raw.json`, `dev-account-story-draft-claude-exit.json`과 해당 실제 화면이다. 실행 스크립트 SHA `2ebefa9cceb1282b63aabfb75efe1fa59c333e4a0e80d31318ea053067caecac`이며, 원문·판본·검수 파일 SHA는 제작·독립 검수 때와 같다.

후속 최신 상태 읽기에서는 새 정상 admin 로그인·새로고침 뒤 `aria-busy=0`인 실제 화면에서 다음 작업이 **「admin 권리 결정」**, 검수 1·`ai_model`·사람 검수 주장 없음, 권리 미확인·발행 0임을 확인했다. **7 PASS · 0 FAIL**, 테스트·Claude 실행 exit0이며 POST 액션 0(조회 GET만)이다. 등록 직후 촬영에 남은 이전 “검수 없음” 안내를 최신 상태의 증거로 사용하지 않는다. 이전 프로세스 소실은 결과 미관찰로, 복구 뒤 첫 cold-start timeout은 실패 이력으로 보존하고 재확인 성공과 구분했다.

최신 증거: `dev-account-story-readback-result-20261026T050139Z.json`, `dev-account-story-readback-resume-claude-exit.json`, `dev-account-story-readback-shots-20261026T050139Z/`. 읽기 스크립트 SHA `fc06ca81eed42a44f73eacd946827c5b59fb0ec8429db550303795265dc14fd9`. 로컬 서버 복구 뒤 `pnpm.cmd dev:check`로 정본 main-serving과 실제 3000 포트 PID 일치를 확인했으며, 계정 생성·역할 SQL은 다시 실행하지 않았다.

학습자 가치의 현재 증거는 다음과 같이 나눈다. 코드 경로는 `apps/web/src/` 기준이며, 편집 목표 난도를 실제 검증된 학습자 수준으로 해석하지 않는다.

| 영역 | 구현 · 코드 근거 | 실제 콘텐츠/dev 증거 · 남은 상태 |
|---|---|---|
| Discover | 구현됨 — `components/library/story/StoryCatalog.tsx`: 작품 묶음 · 첫 장면 · HOOK · 편집 목표 · 빈/실패 상태 | 실제 1440/1280 로그인 서가는 발행 0의 빈 상태. 작품의 자발적 선택은 미검증; 추천 다양성은 S6 후속 |
| Start | 구현됨 — `lib/library/story/learner.ts`: 판본 입구 · 명시적 시작 · 실제 사용자 확인 뒤 위치 저장 | 발행된 실제 작품 시작 · 저장 미검증 |
| Read | 구현됨 — `components/library/story/{StoryReader,StorySourcePanel,StoryUnitText}.tsx`: 본문 · 요청형 원문/단어 도움 | 기존 격리 검증 보존. 실제 발행본 독서·도움 미검증; Deep/Bridge는 S6 후속 |
| Continue | 구현됨 — `components/library/story/story-reader-session.ts`: 위치와 완료 분리 · 판본별 이어하기 · 다음 이야기 이동 | 실제 진도 · 재로그인 복원 · 완독 · 다른 계정 개인 상태 격리 미검증. 빈 서가의 A→B 전환으로 대체하지 않음 |
| Quality | 구현됨 — `components/library/story/use-story-auth-guard.ts`와 서버/RPC의 실제 사용자·권한·판본 결속 검사 | 정상 Auth/SSR 23검사 통과. 대표 판본은 AI 독립 검수 완료; §14 사람 권리 결정과 발행 콘텐츠 적합성/학습자 난도는 미충족·미검증 |
| Integration | 구현됨 — 기존 `components/library/reader/WordLookupPopover.tsx`의 읽기 전용 뜻 조회 | 듣기·어휘 저장·교재 생성 연결은 후속. 기존 TTS·추출·인쇄 자산은 재사용 후보이며 Story→VCB/FAST 콘텐츠 계약은 미설계 |

최상위 목표의 기반 기능은 구현됐지만, 실제 작품을 고르고 이해하며 독서를 지속하는 경험의 종단 수용은 아직 완료가 아니다. 우선 실제 관리자 파일 흐름 결함을 보완하고, 정본의 권리 조건을 충족한 대표 1편으로 발행·독서·저장·철회 여정을 검증한다. 이어 실제 참가자의 흥미·지속·이해를 관찰하며 새 글 독해 성장은 독립 평가로 확인한다. 새 TTS 엔진·전면 개인화·교재공장 재설계는 이번 필수 범위에 추가하지 않는다.

아래 표는 2026-10-25 준비 당시 이력이다.

| 구분 | 내용 |
|---|---|
| 한 일 | 서로 다른 장르의 영어 원작 단편 3편 선정 · Standard Ebooks 원천 내려받기(원천 파일 sha256 기록) · 스냅숏 작성기로 `lcp-story/source-snapshot@1` 생성 · 작품별 편집 기준(`lcp-story/editorial-policy@1`) 작성 · S2 CLI `export` · `validate` · `plan` 실제 실행 |
| 하지 않은 일 | 판본(각색) 결과물 · 검수 작성(별도 세션에 맡긴다) · DB 접근 · 권리 `confirmed` 기록(인증된 사람만 할 수 있다) · 학습자 파일럿 |
| 권리 수준 | 3편 모두 스냅숏 권리 기록은 `claimed_by_source`(원천의 주장)다. 발행 후보 조건(`confirmed`)을 채우지 않는다 — 판본이 생기면 계획은 `rights_unconfirmed:source_text` 로 보류된다 |

## 1. 선정 — 장르가 서로 다른 세 편

조건: 영어 원작(새 번역 권리 없음) · 완결 단편 · 저자 사망 1955년 이전 · 초출 1929년 이전 · 판본 단위 조건이 명시된 원천(Standard Ebooks).

| 작업 | 작품 | 장르 | 초출 | 표면 단어 수 · 문단 | 흥미 진입점(스포일러 없음) | 제작 범위(편집 기준 `production`) |
|---|---|---|---|---|---|---|
| `blue-carbuncle` | Arthur Conan Doyle, "The Adventure of the Blue Carbuncle" | 추리(탐정) | The Strand Magazine 1892년 1월 | 7,815 · 214 | 낡은 모자 하나로 주인을 추리해 보라는 홈스의 도전 | `story-b2`(story_edition, B2) + `easy-b1`(easy_reader, B1) · 둘 다 `deep_reading` |
| `monkeys-paw` | W. W. Jacobs, "The Monkey’s Paw" | 공포 · 서스펜스 | Harper’s Monthly 1902년 9월 | 3,940 · 144 | 소원 세 개를 들어준다는 말라붙은 원숭이 발과 군인의 경고 | `story-b2`(+`deep_reading` · `original_bridge`) + `easy-a2`(easy_reader, A2, `deep_reading`) |
| `red-chief` | O. Henry, "The Ransom of Red Chief" | 유머 · 반어 | The Saturday Evening Post 1907년 7월 6일(2차 자료) · 단행본 Whirligigs 1910 | 4,160 · 98 | 허세 가득한 두 납치범과, 집에 갈 생각이 없는 열 살 아이 | `story-b2`만(+`deep_reading` · `original_bridge`) |

- 표면 단어 수는 `surfaceMetrics`(단어 정규식 계수)다. CEFR · V-Level 실측이 아니다(정본 §5).
- `blue-carbuncle` 은 목표 분량(약 1,500–7,000)의 상한을 약 12% 넘는다. 추리 장르 중 학습자 접근성(명확한 단서 사슬 · 인종 비하 표현 없음)이 가장 좋아 유지했고,
  `easy-b1` 의 축약이 단서를 빠뜨리지 않는지를 검수 쟁점으로 적었다. 짧은 추리 단편으로 바꿀지는 상위 세션이 판단한다.
- 제작하지 않는 조합과 이유:
  - `red-chief` easy_reader 없음 — 웃음이 화자의 과장된 어휘 · 말실수 · 격식 편지체에서 나와, 언어 부담을 낮추면 작품의 핵심이 사라진다. story_edition 검수 뒤에 다시 판단한다.
  - `blue-carbuncle` original_bridge 없음 — 원문과 현대화 판의 표현 차이가 학습 초점이 될 만큼 크지 않다. 대신 추론 근거 고르기(`deep_reading`)가 중심이다.
  - 모든 easy_reader 에 original_bridge 없음 — 쉬운 판의 문장과 원문을 맞대는 것은 이 수준의 학습 목표가 아니다.

## 2. 작품별 출처 · 권리 확인 수준

공통: 판단은 **추론 기록**이며 법적 결론이 아니다. 권리 확인(`confirmed`)은 인증된 사람이 근거 · 확인자 · 시각과 함께 남긴다(정본 §14).
한국 보호기간 근거: 저작권법 제39조(보호기간의 원칙 — 저작자 생존 기간과 사망 후 70년) · 제44조(보호기간은 사망한 다음 해부터 기산),
보호기간을 50년에서 70년으로 늘린 개정(2013-07-01 시행)은 시행 전에 보호기간이 끝난 저작물을 되살리지 않는다는 부칙을 두었다고 알려져 있다.
2026-10-25 준비 시점에는 국가법령정보센터의 조문을 읽지 못했다. 2026-10-26 후속 조사에서는 현재 시행본(2026-08-11)의 [제39조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0039&lsiSeq=283335&urlMode=lsScJoRltInfoR)·[제44조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0044&lsiSeq=283335&urlMode=lsScJoRltInfoR) 원문을 직접 확인했다. [LOC 저자 전거](https://id.loc.gov/authorities/names/n79082292.madsrdf_raw.json)의 사망일과 현행 사후 70년·다음 해 기산을 적용하면 Doyle 원작은 2000-12-31까지 만료됐다는 추론을 뒷받침한다. 부칙의 소급 여부를 확인했다고 주장하지 않으며, 이 조사와 인증된 권리 결정은 별개다.
아래 한국 칸의 예전 여러 기간 산술은 당시 준비 기록이다. 사용한 SE 판본의 [고정 revision LICENSE](https://github.com/standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes/blob/60f53b2fc44178af326d56f45a5b6d02a8badd68/LICENSE.md)는 미국 공유영역 판단과 SE 기여분의 전세계 CC0 헌정을 구분하며, [미국 Copyright Office Circular 15A](https://www.copyright.gov/circs/circ15a.pdf)도 기간 검토의 근거다.

### 2-1. `blue-carbuncle` — Doyle, "The Adventure of the Blue Carbuncle"

| 항목 | 기록 | 근거(확보 방법) |
|---|---|---|
| 초출 | The Strand Magazine No. 13(vol. 3), 1892년 1월 | https://archive.org/details/StrandMagazine13 — 항목 메타데이터(date 1892-01, volume 3)와 OCR 의 표제 "VII.— THE ADVENTURE OF THE BLUE CARBUNCLE" 확인 |
| 저자 | Arthur Conan Doyle, 1859-05-22 ~ **1930-07-07** | 미국 의회도서관 전거 https://id.loc.gov/authorities/names/n79082292 |
| 원천 판본 | Standard Ebooks 판 *The Adventures of Sherlock Holmes*(SE 초판 2018-05-08, David Grigg) — 1999 Project Gutenberg 전사본 #1661 · Internet Archive 스캔 기반. 확보 시점 최신 커밋 `60f53b2fc441`(2026-08-15) | 판본 페이지 · 간기(colophon) |
| 판본 · 전사 조건 | SE: "이 전자책은 미국에서 저작권 제한이 없는 것으로 생각된다 … 미국 밖에서는 현지 법을 확인해야 한다", SE 기여분은 CC0 1.0 공유 영역 헌정 | https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes · `/text/uncopyright` |
| 미국 상태 추론 | 1892년 발행 — 미국에서 1931년 이전 발행 저작물은 보호기간이 끝났다(17 U.S.C. §304 의 발행 후 95년 규칙). 원천도 미국 공유 영역을 주장 | 추론 |
| 한국 상태 추론 | 사망 1930 → 다음 해부터 30년: 1960-12-31 · 50년: 1980-12-31 · 70년: 2000-12-31 만료. 어느 규칙이어도 2026년 기준 만료, 1996년 외국 저작물 소급 보호 시점에 이미 사후 50년이 지났다 | 위 조문(원문 대조 전) |
| 기원국(영국) | 사후 70년 → 2000-12-31 만료 | 추론 |
| 미해결 | 'Sherlock Holmes' 이름을 제품 표지 · 마케팅에 쓰는 문제(상표 · 이름 사용)는 저작권과 별개다. 삽화(Sidney Paget)는 쓰지 않는다 | — |
| 스냅숏 권리 기록 | `source_text` = `claimed_by_source`, `evidence_ref` = SE 판본 페이지, `checked_by` · `checked_at` = null | `sources.json` |

### 2-2. `monkeys-paw` — Jacobs, "The Monkey’s Paw"

| 항목 | 기록 | 근거(확보 방법) |
|---|---|---|
| 초출 | Harper’s Monthly Magazine, 1902년 9월(vol. 105) · 같은 해 단행본 *The Lady of the Barge* 수록 | https://harpers.org/archive/1902/09/the-monkeys-paw/ — 발행처 자체 기록 보관 페이지의 구조화 메타데이터(datePublished 1902-09-01). 지면 스캔은 유료 열람이라 보지 못했다 |
| 저자 | W. W. Jacobs, 1863-09-08 ~ **1943-09-01** | https://id.loc.gov/authorities/names/n50027985 |
| 원천 판본 | Standard Ebooks 판 *The Lady of the Barge*(SE 초판 2014-05-25, Alex Cabal) — 2006 Project Gutenberg 전사본 #12133 · Internet Archive 스캔 기반. 최신 커밋 `678dc8e02b08`(2026-08-15) | 판본 페이지 · 간기 |
| 판본 · 전사 조건 | 위와 같은 SE 문구(미국 기준 공유 영역 주장 · SE 기여분 CC0) | https://standardebooks.org/ebooks/w-w-jacobs/the-lady-of-the-barge |
| 미국 상태 추론 | 1902년 발행 — 1931년 이전 발행 | 추론 |
| 한국 상태 추론 | 사망 1943 → 30년: 1973-12-31 · 50년: 1993-12-31 · 70년: 2013-12-31 만료. 세 편 중 가장 늦지만 어느 규칙이어도 2026년 기준 만료 | 위 조문(원문 대조 전) |
| 기원국(영국) | 사후 70년 → 2013-12-31 만료 | 추론 |
| 미해결 | 초출 지면을 스캔으로 보지 못했다(발행 연도 1902는 단행본 간기 · SE 간기와도 일치) | — |
| 스냅숏 권리 기록 | `claimed_by_source` · `evidence_ref` = SE 판본 페이지 | `sources.json` |

### 2-3. `red-chief` — O. Henry, "The Ransom of Red Chief"

| 항목 | 기록 | 근거(확보 방법) |
|---|---|---|
| 초출 | The Saturday Evening Post 1907-07-06 — **2차 자료로만 확인**(https://en.wikipedia.org/wiki/The_Ransom_of_Red_Chief) | 1차 근거는 단행본: *Whirligigs*(New York: Doubleday, Page & Company, 1910) 스캔 https://archive.org/details/whirligigs02henrgoog — OCR 로 목차 · 표제와 판권 "COPYRIGHT, 1910, BY DOUBLEDAY, PAGE & COMPANY" 확인 |
| 저자 | O. Henry(William Sydney Porter), 1862-09-11 ~ **1910-06-05** | https://id.loc.gov/authorities/names/n79071080 |
| 원천 판본 | Standard Ebooks 판 *Short Fiction*(SE 초판 2020-03-23, Vince Rice) — Project Gutenberg 전사본(Whirligigs #1595 등)과 여러 스캔 기반. 최신 커밋 `f8f8fbb58336`(2026-10-22) | 판본 페이지 · 간기 |
| 판본 · 전사 조건 | 위와 같은 SE 문구 | https://standardebooks.org/ebooks/o-henry/short-fiction |
| 미국 상태 추론 | 1907(잡지) · 1910(단행본) 발행 — 1931년 이전 발행 | 추론 |
| 한국 상태 추론 | 사망 1910 → 30년: 1940-12-31 · 50년: 1960-12-31 · 70년: 1980-12-31 만료 | 위 조문(원문 대조 전) |
| 미해결 | 초출 지면(1907) 1차 스캔 미확인 — 결론에는 영향이 없다(1910 단행본만으로도 1931년 이전 발행) | — |
| 스냅숏 권리 기록 | `claimed_by_source` · `evidence_ref` = SE 판본 페이지 | `sources.json` |

## 3. 스냅숏 — 원천 파일과 정체

확보: `curl -sL` · 2026-10-24T17:45:56Z~17:46:00Z(UTC) · 원천 파일은 커밋하지 않는다(`work/lcp-story-pilot/raw/`, 저장소 `/work/` gitignore).

| 작업 | 원천 URL | 원천 파일 sha256(바이트) | `text_sha256` | `identity_sha256` |
|---|---|---|---|---|
| `blue-carbuncle` | https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes/text/the-adventure-of-the-blue-carbuncle | `2b2c94c2d525bf451d4d703a37a8bc65b0f4c5969372b38f9ea09b0401abc798`(48,887) | `391413941cedf99977ff340a1f5b49476222c38facd578b0afe2884bb570a129` | `63b8416a8aec8ca90cead780b811a78fab57700d0f80a4b5f2d49f093ed8be33` |
| `monkeys-paw` | https://standardebooks.org/ebooks/w-w-jacobs/the-lady-of-the-barge/text/the-monkeys-paw | `ea9da3f1b82237817f2851079e7dc4c50bffee8bc8b7f3aeabd9bf31d99924ff`(27,080) | `187a0599bf2ee3e8e1fce8b96b1c4d27a7dce27895dfd556124a0a3c95d6f3b0` | `9a94f2e07a2fba2f891a59db103b7a4dc4bd7fb2d62a3005e60600d66ce3b860` |
| `red-chief` | https://standardebooks.org/ebooks/o-henry/short-fiction/text/the-ransom-of-red-chief | `cf4643333fba4fbdd349cbc59b7df4840dc96e7f48d566f8ed60fc4b7dac71f1`(25,720) | `8a72877103ac8352accede65ff8fe654e11c9ebeffe6a537d0bb583e61185d07` | `ecffb7ac57d172e92d36f929ae93913a37190802311f8d8842d06f3646013307` |

- 해시는 손으로 계산하지 않았다: `text_sha256` 은 `sourceTextSha256`, `identity_sha256` 은 `validateSnapshot` 이 계산한 값이다(`build.ts check` 로 재확인).
- 스냅숏 공통값: `source_kind: external_file` · `library_book_id: null` · `synthetic: false` · `source: standard_ebooks` · `text_language: en` ·
  `original_language: en` · `translator: null` · `coverage: complete_work` · `captured_at` = 각 응답의 HTTP `Date`.
- 추출 규칙 `se-web-xhtml-v1`(`scripts/lcp/story/pilot/build.ts`): 원천 파일 sha256 · 바이트 수를 먼저 대조 → 엄격한 UTF-8 해독 → `<article id=…>` 안의 `<p>` 마다 한 문단.
  작품 제목(h2)은 `work.title` 과 일치를 확인한 뒤 빼고, 장 번호(h3)도 빼되 장 첫 문단 번호를 `coverage_note` 에 코드가 적는다. 허용 목록 밖 요소(각주 링크 · 줄바꿈 · 그림)는 조용히 버리지 않고 오류로 멈춘다.
  조판용 보이지 않는 문자만 바꾼다 — U+2060 삭제(18 · 10 · 10개), U+200A 삭제(20 · 0 · 0개), U+00A0 → 공백(26 · 20 · 4개). 낱말 · 문장부호는 바꾸지 않는다. 마지막에 `normalizeSourceText`(바뀐 글자 없음).
- 구조: `monkeys-paw` 장 I · II · III 의 첫 문단 0 · 66 · 96. `blue-carbuncle` 신문 기사(인용 블록) 문단 60. `red-chief` 편지 두 통 문단 49–54 · 84–86.
- **판본 성격**: Standard Ebooks 판은 철자 · 구두점을 현대화한 편집 판이다(예: 변경 이력의 "Bagdad → Baghdad"). 스냅숏의 '원문'은 초출 지면과 글자 단위로 같지 않다 —
  original_bridge 활동 안내가 이것을 숨기지 않아야 한다(편집 기준 검수 쟁점에 적음).

## 4. 편집 기준 요약

편집 기준 결과 파일은 커밋 대상 위치 `scripts/lcp/story/pilot/<작업>.policy.json` 에 둔다(공유 영역 원문의 짧은 인용만 담는다).
작성 초안(`work/lcp-story-pilot/drafts/<작업>.policy-draft.json`, 커밋 안 함)에는 앵커를 `{paragraph, quote}` 로만 적고,
`build.ts policy` 가 그 문단 안에서 인용이 정확히 한 번 나오는지 확인한 뒤 `start` · `end` · `source_sha256` 을 계산하고 `validatePolicy` 를 통과한 것만 쓴다.

| 작업 | `policy_sha256` | 보존 요소(사건 · 동기 · 인과 · 복선 · 어조) | 민감 표현과 처리 | 진입 장면(문단) |
|---|---|---|---|---|
| `blue-carbuncle` | `c7297a9c089b3b2299ef188d9d257087babd4fe63f6b3735414fc2ba5b31bf6b` | 11 · 4 · 4 · 3 · 4 (story_edition 전용 3) | 머리 크기로 지능을 판단하는 유사과학(p33) · 아내의 애정과 남편 옷차림을 잇는 성 역할 가정(p27 · p41) — 둘 다 `retain_with_context` | 0 · 2 · 10 · 22 |
| `monkeys-paw` | `9d5cf93af43a7e97893859439023472cf5743d0304c39d0be7eaf0a32bb36d3a` | 9 · 4 · 2 · 6 · 4 (story_edition 전용 3) | 식민지 시기 인도를 마법 · 'fakir' 의 땅으로 그리는 이국 취향(p12 · p17 · p25) · 성별 곁말(p51 · p77) — 둘 다 `retain_with_context` | 0 · 22 · 25 · 32 |
| `red-chief` | `e4a7ff6d9a34f58c783d6eb5fc93a01e919654a7f6c9d4ffa8969ba1cfc57cbd` | 9 · 3 · 2 · 4 · 4 (story_edition 만 제작) | 아메리카 원주민 고정관념을 재현하는 '인디언 놀이'(p10 · p11 · p22 · p58) `retain_with_context` · 원주민 비하어 2곳(p15 · p59) `revise_with_note` · 흑인 비하 합성어 1곳(p36) `revise_with_note` · 성별 고정관념 농담(p21) `retain_with_context` | 0 · 3 · 5 · 6 |

| 작업 · 판본 | `target_sha256` | 언어(`editorial_target`) | 사고(`editorial_judgment`) | 배경지식 | 활동 |
|---|---|---|---|---|---|
| `blue-carbuncle` `story-b2` | `ed1b779ce619f7e32a16e80cd2d3ef37bc6579e248c11e62fec0ed307aeb7db6` | B2 · V 7–8 | high | moderate | deep_reading |
| `blue-carbuncle` `easy-b1` | `d548563aba2d3b5046814cb411774840fcd39ab93fcbcb7b3dad84e9ab6dd88d` | B1 · V 5–6 | moderate | low | deep_reading |
| `monkeys-paw` `story-b2` | `bf21256ab98cba56526f7dab6b37f58738f44cbef495cfefd566555733dc762b` | B2 · V 6–8 | moderate | moderate | deep_reading · original_bridge |
| `monkeys-paw` `easy-a2` | `529568c05a8f7c7bdd35a446dc891b77b6e3926d2fb700ff5508e6147e5c40fc` | A2 · V 3–4 | moderate | low | deep_reading |
| `red-chief` `story-b2` | `025baaf339797d41826a13e8f6fcb6da131b4b697267c4523bebb16def2d0459` | B2 · V 7–9 | high | high | deep_reading · original_bridge |

- 모든 판본은 `complete_work`(원문 전 문단)다. 언어 · 사고 · 배경지식 · 정서 축은 따로 적었고, 언어 목표 · 사고 판단은 실측이 아니다(정본 §5).
- 정서 주의: `monkeys-paw` 자녀의 사고사 · 시신 훼손 암시 · 한밤의 공포, `red-chief` 아동 납치 희극 · 아이와 어른 사이의 폭력, `blue-carbuncle` 보석 과거사의 강력 범죄 한 줄 언급 · 범인의 울며 비는 장면.
- 진입 장면은 사건의 결과(보석 발견 · 허버트의 죽음 · 몸값 역전)를 드러내지 않는 구간만 골랐다.
- `red-chief` 편집 기준의 민감 표현 앵커는 기계 검증을 위해 비하어 원문 한 낱말을 인용으로 담는다(판본은 그 낱말을 재생산하지 않고 바꾸며 학습자 설명을 단다). 이 문서에는 그 낱말을 적지 않는다.
- 검수 쟁점(`review_concerns`)에 적은 것: 추론의 '근거 → 결론' 보존 · 공정한 단서 보존 · 결말의 절제(문 밖의 존재를 보여 주지 않음) · 완곡한 사망 통보의 추론 가능성 ·
  화자의 과장된 어휘가 납작해지지 않는지 · 맥락 주석이 설교가 되지 않는지 · 현대화 편집 판이라는 원천 성격.

## 5. S2 CLI 실행 기록 (2026-10-25, 저장소 루트)

```bash
# 스냅숏 · 편집 기준 (작업 = blue-carbuncle · monkeys-paw · red-chief)
pnpm exec tsx scripts/lcp/story/pilot/build.ts snapshot --work <작업>                                                       # 0 ×3 (재실행 unchanged)
pnpm exec tsx scripts/lcp/story/pilot/build.ts policy   --work <작업> --in work/lcp-story-pilot/drafts/<작업>.policy-draft.json  # 0 ×3
pnpm exec tsx scripts/lcp/story/pilot/build.ts check    --work <작업>                                                       # 0 ×3

# 로컬 제작 드레인 (작업 이름 = <작업>-r1)
pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story-pilot/export --work <작업>-r1 \
  --source work/lcp-story-pilot/snapshots/<작업>.snapshot.json --policy scripts/lcp/story/pilot/<작업>.policy.json
pnpm exec tsx scripts/lcp/story/story.ts validate --root work/lcp-story-pilot/export --work <작업>-r1
pnpm exec tsx scripts/lcp/story/story.ts plan     --root work/lcp-story-pilot/export --work <작업>-r1
```

| 작업 이름 | export | validate | plan | 계획 결과 |
|---|---|---|---|---|
| `blue-carbuncle-r1` | 0(기록 5) | 2(`missing` 2) | 2 | `story-b2` · `easy-b1` = `pending`(`edition_missing`) · 후보 0 · `db_write:false` |
| `monkeys-paw-r1` | 0(기록 5, 재실행 0 · 그대로 5) | 2(`missing` 2) | 2 | `story-b2` · `easy-a2` = `pending`(`edition_missing`) · 후보 0 |
| `red-chief-r1` | 0(기록 4) | 2(`missing` 1) | 2 | `story-b2` = `pending`(`edition_missing`) · 후보 0 |

- 오류 0. `policy` 첫 실행 1회는 종료 1 이었다(`monkeys-paw` 문단 134 에 인용이 두 번 나와 앵커를 하나로 좁힐 수 없음) — 인용을 늘려 다시 실행해 0.
- 원장(`export.json`)의 `source_identity_sha256` · `policy_sha256` · `target_sha256` 은 위 표의 값과 같다.
- 판본이 아직 없어 계획은 `pending` 이다. 판본이 생기면 권리가 `claimed_by_source` 라 `rights_unconfirmed:source_text` 로 `hold` 가 된다(현재 정책대로의 기대 동작).
- 판본 결과물 · 검수 결과는 이 회차에서 만들지 않았다. 작업 폴더의 과제 파일(`<판본>.task.json`)이 다음 세션의 입력이다.

## 6. 측정 계획 (실행 전 고정 · 데이터 없음)

측정 정의는 [IMPLEMENTATION S7](./IMPLEMENTATION.md) 의 표(흥미 · 시작 / 자발적 지속 / 이해 / 미노출 글 전이, 각 분모 · 조건)를 그대로 따른다. 이 회차의 값은 모두 `NOT_RUN` 이다.

- 기준선을 먼저 재고 그 뒤에 목표 수치를 정한다. 임의 완독률 · 향상률을 성공 기준으로 미리 쓰지 않는다.
- 하지 않은 활동 · 측정 못 한 값 · 시험하지 않은 조건은 0 이 아니라 `missing` · `untested` 로 센다.
- 세 편은 장르 · 길이 · 판본 조합이 서로 다르다. 작품 간 결과 차이를 장르 효과나 각색 효과로 해석하지 않는다(정본 §19).

## 7. 미확인 · 공백 — S4 발행 전에 남은 조건

1. **권리 확인**: 대표본의 현행 조문·저자 사망일·SE 판본 조건은 위 후속 AI 조사로 확인했다. 정본 §14의 사람 권리 결정은 별개로 미충족이며, 현재 DB에는 인증된 관리자의 근거·확인자·시각을 갖춘 `confirmed` 결정이 없다. AI 조사 완료를 사람 승인으로 기록하지 않는다. 나머지 두 작품의 실제 제작·발행은 이번 범위가 아니다.
2. **원천 주장과 DB 결정 구분**: 스냅숏의 권리 주장 자체를 바꾸면 identity hash가 달라져 새 스냅숏·revision·작업으로 재결속해야 한다. 반면 기존 S4 `story_admin_record_rights`가 별도 `story.rights_decisions`에 남기는 인증된 결정은 스냅숏을 수정하지 않는다. 이 경로에서는 기존 판본·검수를 재생성할 필요가 없으며, 로컬 CLI의 `rights_unconfirmed`와 DB의 최신 권리 결정에 따른 노출 게이트를 구분한다.
3. 초출 1차 근거가 약한 곳: `red-chief`(Saturday Evening Post 1907 지면 미확인) · `monkeys-paw`(Harper’s 지면 스캔 미열람). 두 경우 모두 1931년 이전 발행이라는 판단에는 영향이 없다.
4. 이름 · 상표: 'Sherlock Holmes' 등 인물 · 작품 이름을 제품 표지 · 홍보 문구에 쓰는 문제는 저작권과 별개로 확인한다.
5. 편집 기준 내용 검토: 이 편집 기준은 한 AI 세션이 작성했다. 민감 표현 판단(특히 `red-chief` 의 처리 방식 선택)과 수준 목표는 사람 또는 독립 검수자가 판본 검수 때 함께 본다.
6. `blue-carbuncle` 분량(표면 7,815 단어)이 목표 상한을 넘는다 — 유지 또는 교체 판단.
7. 학습자 파일럿: 실제 참가자가 없어 `PILOT_NOT_RUN` 이다. 기본 독서 경로 파일럿은 S4 · S5 뒤에 한다.

## 8. 파일

| 위치 | 커밋 | 내용 |
|---|---|---|
| `scripts/lcp/story/pilot/build.ts` | 대상 | 스냅숏 작성기 · 편집 기준 앵커 계산기 · 재검증(`snapshot` · `policy` · `check`) |
| `scripts/lcp/story/pilot/sources.json` | 대상 | 원천 확보 기록(URL · 원천 파일 sha256 · HTTP 날짜) · 출처 근거 · 스냅숏 메타데이터 · 권리 주장 기록 |
| `scripts/lcp/story/pilot/{blue-carbuncle,monkeys-paw,red-chief}.policy.json` | 대상 | 앵커를 계산한 편집 기준 3편 |
| `docs/lcp-story/S7_PILOT.md` | 대상 | 이 기록 |
| `work/lcp-story-pilot/raw/` · `meta/` | 아님 | 원천 XHTML · 응답 헤더 · 확보 시각 · 출처 확인에 쓴 메타데이터 페이지 |
| `work/lcp-story-pilot/snapshots/` | 아님 | 스냅숏(원문 전문) · 문단 목록 · 작성 보고 |
| `work/lcp-story-pilot/drafts/` · `export/` · `cli-logs/` | 아님 | 편집 기준 초안 · S2 작업 폴더 3개 · CLI 출력 |
