# LEARNING_ENVIRONMENTS — 학습 환경·사용자 경험 전수

> 기준 a7c986469 · DB SELECT 2026-10-09 · 상세 표(라우트·코드 경로·테이블·테스트): [_raw/area-learning.md](./_raw/area-learning.md) · 재측정: [_raw/db-demand.md](./_raw/db-demand.md)

## 0. 판정 원칙

- 계정은 `auth.users` **5개**이고 로그인 계정은 전부 개발·검증 계정이다. **실제 학습자가 검증한 환경은 0개**다. 익명 이벤트 2,847건(landing_viewed 181)은 출처를 판별할 수 없다.
- 그래서 `VERIFIED_WORKING` 은 이 문서에서 **「검증 계정의 실제 저장 기록이 있다」**는 뜻으로만 쓴다. 사용자 경험 검증이 아니다.
- e2e 스펙 79개는 저장소에 실행 결과가 없고, **CI 의 e2e job 도 시크릿 미설정으로 건너뛴다**(2026-10-08 run 로그 「e2e 건너뜀」). 공개 스모크 `33-public-surface` 를 포함해 e2e 통과는 확인되지 않았다.
- `screen_viewed` 는 e2e 일괄 점검일(10-05·06·08)에 몰려 있어 실사용 근거로 쓰지 않았다.
- 기록 0 은 「결함」이 아니다. 저장 경로가 코드에 있으면 IMPLEMENTED_UNVERIFIED 로 두고, 결함은 재현한 뒤에만 판정한다.

## 1. 모듈별 상태

| # | 환경 | 영역 | 라우트 | 상태 | 핵심 근거 |
|---|---|---|---|---|---|
| 1 | TextViewer · 라이브러리 읽기 | 독해·어휘 획득 | `/text*` `/library/*` | **PARTIAL** | 완료 정본 `texts.status`(`lib/library/complete-chapter.ts:58`) — completed **0** (not_started 207 · extracted 61 · in_progress 10). 분할 테이블 `reading_sessions` 287건도 전부 pending(완료값 `done` 0) |
| 2 | WordVault | 어휘 부호화 | `/wordvault*` | IMPLEMENTED_UNVERIFIED | 학습기록 4, 마지막 06-28 |
| 3 | Flashcard | 어휘 재인·SRS | `/flashcard*` | VERIFIED_WORKING | 학습기록 59, 마지막 09-19 |
| 4 | WordBlitz | 어휘 자동화 | `/wordblitz` `/play/wordblitz` | VERIFIED_WORKING | 29, 마지막 10-03 · 라우트 규약이 다른 모듈과 다르다 |
| 5 | PairFlip | 어휘 공간기억 | `/pairflip*` | IMPLEMENTED_UNVERIFIED | 9, 마지막 07-10 · 단위 테스트 0 |
| 6 | SpellForge | 철자 생성 | `/spellforge*` | IMPLEMENTED_UNVERIFIED | 저장 경로 있음(`SpellForge.tsx:199` → `/api/srs/flush` → `lib/srs/flush-actions.ts:164`). 진입 145회인데 기록 0 — 결함인지 완주 미발생인지는 재현 전에 판단 불가 |
| 7 | EchoMatch | 발음·청각 생성 | `/text/[id]/echo` | IMPLEMENTED_UNVERIFIED | 저장 경로 있음(`lib/echo/record-sound.ts:86`) · 전용 테이블 9행 · learning_records(echo) 0 — 대상 단어가 없으면 정상적으로 무기록 |
| 8 | ScriptQuiz | 지문 이해 | `/scriptquiz*` | IMPLEMENTED_UNVERIFIED | `scores` 23, 마지막 08-17 |
| 9 | Dictation | 듣기·받아쓰기 | `/dictate*` | VERIFIED_WORKING | 학습기록 166 · 세션 15 (마지막 08-16) |
| 10 | Dashboard · Reports · Plan | 회고·목표 | `/dashboard` 등 | IMPLEMENTED_UNVERIFIED / Reports PARTIAL | 리포트 1건 · study_plan_items 6 · `lib/learner/recent-activity-query.ts:113` 은 learning_records·scores 만 읽는다 |
| 11 | Hub · 포털 · 오늘 처방 | 진입·추천 | 학습자 허브 | IMPLEMENTED_UNVERIFIED | |
| 12 | Practice · CTP/DCP | 구문·문장 연습 | practice 계열 | IMPLEMENTED_UNVERIFIED | 소비 경로 `lib/learner/dcp-actions.ts:249` · 시도 20 |
| 13 | 아케이드 / Game Lab | 어휘·형태소 게임 16~19종 + 3D | `/play/*` | VERIFIED_WORKING(16종) · 3D 2종 IMPLEMENTED_UNVERIFIED | ghost-race 132 · cascade 97 … 마지막 08-25 · 목적·계층은 `docs/MODULES.md` Game Lab 절 |
| 14 | CSAT 학습자 | 진단·학습 지도·세션·해설 | `/csat*` | **PARTIAL** | 지도 과제 21·완료 0 · `csat_session_attempts` 1(`api/csat/session/record/route.ts:41`) · csat_item_attempts 20 · csat_dx_response 90 · 세션 원문은 학습자가 가져온 PDF(`PaperDrop.tsx`) · 자체 복습 큐(`lib/csat/session/model.ts`) |
| 15 | CSAT 오답원인 캡처(EC) | 메타인지 | `/csat/*` | EXPERIMENTAL | 세션 0 · 정리된 테스트 기록 6 · 관련 마이그레이션이 main 에 없음 |
| 16 | 만화 | 그림 읽기 | `/comics*` | IMPLEMENTED_UNVERIFIED | 진도 기록 `save_comic_progress`(`ComicReader.tsx:133`) · comic_read_progress 2 · CCP comic_books 1~2 (PDCP 이슈 969 는 별도 계통) |
| 17 | 영상 · 강의 · TTS | 듣기·강의 | `/video`(marketing 그룹) · 교재 화면 · `/csat` 강의 | IMPLEMENTED_UNVERIFIED | 영상은 교재 화면(`ShelfScreen.tsx:70` · `VolumeContents.tsx:530`)에 삽입되지만 학습 기록 연결 없음 · CSAT 강의는 커밋된 대본(`lib/csat/lecture/store.ts:38`) + Web Speech/무음 하이라이트 재생(`LectureStage.tsx:140`) · 서버 음성·저장 오디오는 미구현 |
| 18 | 진단 · V-Level | 수준 배치 | 진단 5종 | IMPLEMENTED_UNVERIFIED | 결과 23 · 스냅샷 22 · 단위 테스트 0 |
| 19 | 교실(학생 측) | B2B 과제 | `/join/[code]` | IMPLEMENTED_UNVERIFIED | classes **1** · members 0 · assignments 0 |
| 20 | 인증 · 온보딩 | 진입 | `/login` 등 | IMPLEMENTED_UNVERIFIED | e2e 미실행(CI 건너뜀) |
| 21 | 전이 · 재평가 | transfer | CSAT 지도 `phase='transfer'` | DESIGN_ONLY~IMPLEMENTED_UNVERIFIED | `learning_task_attempts` 0행 |
| 22 | `/hub-lab` · `/dev/*` | 실험 | | EXPERIMENTAL | 링크 없음 · `/dev/*` 일부는 프로덕션 가드 없음 |
| 23 | **TextFit 공개 지문 진단** | 비로그인 독해 진단·학습지 | `/fit` | IMPLEMENTED_UNVERIFIED | 단어 복사·결과 공유·학년 선택·학습지 출력(`components/textfit/PublicFitClient.tsx:270`) · fit_viewed 270 · F3 「BYO 축」의 실체 |
| 24 | 교재 시리즈 학습 | 교재 읽기·연습 | `/library/textbooks/*` | PARTIAL | 연습 화면이 생성형 9유형 미지원을 명시(`library/textbooks/[series]/[step]/practice/page.tsx:15`) |

## 2. 영역별 커버리지 (요청 영역 기준)

| 영역 | 존재하는 환경 | 판정 |
|---|---|---|
| 어휘 | WordVault · Flashcard · WordBlitz · PairFlip · SpellForge · 아케이드 · 공용 단어장 | 가장 두텁다. 최근 6주 기록은 WordBlitz·Flashcard 뿐 |
| 구문 | Practice/CTP · CSAT 구조 분석 | 생성량이 크고 소비는 20건 |
| 독해 | TextViewer · 라이브러리 · 교재 · ScriptQuiz · CSAT 세션 · 만화 · TextFit | texts 완료 0 — 핵심 루프가 기록상 닫힌 적이 없다 |
| 듣기 | Dictation · 영상 · CSAT 강의 | Dictation 만 기록 있음 |
| 발음 | EchoMatch | 저장 경로 있음 · 측정 기록 0 |
| TTS | 브라우저 음성합성(강의·모듈) · `dev/tts-probe` | 저장 오디오 없음 |
| 강의 | CSAT 강의 재생 · 영상(교재 삽입) | 재생은 구현, 학습 기록 연결 없음 |
| 게임형 | 아케이드 19종 + 3D | 「비게임화 포지션」(LEARNER_MANAGEMENT)과 상위 전략 관계 미정 |
| 진단 | 진단 5종 · CSAT dx · TextFit | 척도가 다르다(어휘 수준 vs 성취·함정 취약성 vs 지문 적합) |
| 복습 | FSRS(`lib/srs/fsrs.ts`) · CSAT 자체 복습 큐 | 둘이 따로 돈다 |
| 전이·재평가 | CSAT 지도 transfer | 데이터 0 |

## 3. 끊기거나 겹치는 표면

- 학습 기록 저장소가 **다섯 갈래**다: `learning_records` · `learning_task_attempts` · `csat_*` · `dictation_*` · `echo_*`. 모듈마다 단위가 다른 것은 의도일 수 있다(읽기 `texts`, ScriptQuiz `scores`). 확인된 사실은 Dashboard 최근 활동이 learning_records·scores 만 읽어 **CSAT 학습이 회고에 나타나지 않는다**는 점이다.
- 리다이렉트 전용 page 9개(`/my*` · `/library` · `/comics` · `/csat/space` · `/wordvault` 등)가 page 수 194를 부풀린다.
- `components/text-viewer` 와 `components/textviewer` 두 디렉터리가 같이 있다.
- 이벤트에는 남아 있지만 page 파일이 사라진 화면: `csat-type` · `csat-plan`.
- `/video` 는 (marketing) 그룹이다. 교재 화면에 삽입되긴 하지만 학습 기록·허브와는 연결되지 않는다.
