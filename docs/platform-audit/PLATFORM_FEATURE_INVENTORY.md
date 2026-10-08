# PLATFORM_FEATURE_INVENTORY — 전체 기능 목록 · 구현 상태

> 기준 a7c986469 · 2026-10-09 · 상세 근거는 각 영역 문서와 `_raw/` 원자료. Codex 독립 리뷰(17건) 반영본.
> 상태 8단계: VERIFIED_WORKING · IMPLEMENTED_UNVERIFIED · PARTIAL · DESIGN_ONLY · EXPERIMENTAL · UNMERGED · DEPRECATED · UNKNOWN.
> **실제 학습자가 0명**이고 CI 의 e2e 도 건너뛰고 있어, 어떤 기능도 「사용자 경험 검증」을 받지 못했다. VERIFIED_WORKING = 검증 계정의 실제 저장 기록(또는 CI 정적 검사 성공)이 있다는 뜻이다.

## 상태 분포 (74개 항목 · 표의 첫 상태어 기준 기계 계수)

| 상태 | 수 |
|---|---|
| VERIFIED_WORKING | 14 |
| IMPLEMENTED_UNVERIFIED | 27 |
| PARTIAL | 16 |
| DESIGN_ONLY | 3 |
| EXPERIMENTAL | 5 |
| UNMERGED | 5 |
| DEPRECATED | 2 |
| UNKNOWN | 2 |

## 학습 환경 (F-L) — [LEARNING_ENVIRONMENTS.md](./LEARNING_ENVIRONMENTS.md)

| ID | 기능 | 상태 | 핵심 근거 |
|---|---|---|---|
| F-L01 | TextViewer · 라이브러리 읽기 | PARTIAL | `texts` completed 0 · `reading_sessions` 287 전부 pending |
| F-L02 | WordVault | IMPLEMENTED_UNVERIFIED | 기록 4 · 06-28 |
| F-L03 | Flashcard | VERIFIED_WORKING | 59 · 09-19 |
| F-L04 | WordBlitz | VERIFIED_WORKING | 29 · 10-03 |
| F-L05 | PairFlip | IMPLEMENTED_UNVERIFIED | 9 · 07-10 · 단위 테스트 0 |
| F-L06 | SpellForge | IMPLEMENTED_UNVERIFIED | 저장 경로 있음(`flush-actions.ts:164`) · 진입 145 · 기록 0 |
| F-L07 | EchoMatch | IMPLEMENTED_UNVERIFIED | 저장 경로 있음(`record-sound.ts:86`) · 공용 기록 0 |
| F-L08 | ScriptQuiz | IMPLEMENTED_UNVERIFIED | scores 23 · 08-17 |
| F-L09 | Dictation | VERIFIED_WORKING | 166 · 08-16 |
| F-L10 | Dashboard · Reports · Plan | IMPLEMENTED_UNVERIFIED | 리포트 1 · CSAT 미반영 |
| F-L11 | Hub · 오늘 처방 | IMPLEMENTED_UNVERIFIED | |
| F-L12 | Practice · CTP/DCP | IMPLEMENTED_UNVERIFIED | 시도 20 |
| F-L13 | 아케이드(Game Lab) 16종 | VERIFIED_WORKING | 마지막 08-25 |
| F-L14 | CSAT 학습자(진단·지도·세션·해설) | PARTIAL | 지도 완료 0 · 세션 1 |
| F-L15 | CSAT 오답원인 캡처(EC) | EXPERIMENTAL | 세션 0 |
| F-L16 | 만화 열람 · 진도 | IMPLEMENTED_UNVERIFIED | comic_read_progress 2 |
| F-L17 | 영상 열람(마케팅·교재 삽입) | IMPLEMENTED_UNVERIFIED | 학습 기록 없음 |
| F-L17b | CSAT 강의 재생(Web Speech) | IMPLEMENTED_UNVERIFIED | `LectureStage.tsx:140` |
| F-L18 | 진단 · V-Level | IMPLEMENTED_UNVERIFIED | 결과 23 |
| F-L19 | 교실(학생) | IMPLEMENTED_UNVERIFIED | members 0 |
| F-L20 | 인증 · 온보딩 | IMPLEMENTED_UNVERIFIED | e2e 미실행 |
| F-L21 | 전이 · 재평가 | DESIGN_ONLY | task_attempts 0 |
| F-L22 | hub-lab · dev 화면 · 3D 게임 2종 | EXPERIMENTAL | |
| F-L23 | TextFit 공개 지문 진단(공유·학습지 출력) | IMPLEMENTED_UNVERIFIED | `PublicFitClient.tsx:270` · fit_viewed 270 |
| F-L24 | 교재 시리즈 읽기·연습 | PARTIAL | 생성형 9유형 미지원 명시 |

## 콘텐츠 파이프라인 (F-C) — [CONTENT_PIPELINE_ATLAS.md](./CONTENT_PIPELINE_ATLAS.md)

| ID | 기능 | 상태 |
|---|---|---|
| F-C01 | LCP 도서 | VERIFIED_WORKING(산출) |
| F-C02 | ACP 기사 | PARTIAL(ready 92.3% 미발행) |
| F-C03 | VCB 어휘·단어장·챕터 퀴즈 | VERIFIED_WORKING |
| F-C04 | VRL 분류·진단 문항 | IMPLEMENTED_UNVERIFIED |
| F-C05 | 사전 채움 | VERIFIED_WORKING |
| F-C06 | pending_words 드레인 | PARTIAL |
| F-C07a | lexicon · freq | VERIFIED_WORKING(내부 자원) |
| F-C07b | topic corpus | PARTIAL(소비처 없음) |
| F-C08 | WLP(NLP·QA 공용 패키지) | IMPLEMENTED_UNVERIFIED |
| F-C09 | CSAT 원문 발굴·판정 | PARTIAL(일일 감사 실패) |
| F-C10 | CSAT 문항 분석 | VERIFIED_WORKING(산출) |
| F-C11 | CTP/DCP 대량 생성 | PARTIAL(접근 가능·사용 없음) |
| F-C11b | CSAT 기출 세션 원문(학습자 PDF) | IMPLEMENTED_UNVERIFIED |
| F-C12 | 교재 공장 — main(창작 집필·각색·문항·해설·조립) | PARTIAL |
| F-C12b | 교재 공장 — 시중 교재 추출(phase1) | UNMERGED |
| F-C13 | 저작 지문 · SE 난이도 | IMPLEMENTED_UNVERIFIED |
| F-C13b | Compose 재저작(취재→원장→작성→검수→발행) | IMPLEMENTED_UNVERIFIED |
| F-C14 | CCP 도서→만화 | EXPERIMENTAL |
| F-C15 | PDCP 만화 현대화 | PARTIAL(ADR 0007 제거 결정과 충돌) |
| F-C16 | 영상 팩토리 | VERIFIED_WORKING(산출) |
| F-C17 | 서버 음성 생성·저장 오디오 | DESIGN_ONLY |
| F-C18 | 학습 원리 등록부 | PARTIAL |
| F-C19a | 아케이드 오디오 | VERIFIED_WORKING |
| F-C19b | Tines 삽화 | EXPERIMENTAL |

## 공통 시스템 (F-S) — [PLATFORM_SHARED_SYSTEMS.md](./PLATFORM_SHARED_SYSTEMS.md)

| ID | 기능 | 상태 |
|---|---|---|
| F-S01 | 인증 · 역할 | VERIFIED_WORKING |
| F-S02 | 학습 기록 코어 | VERIFIED_WORKING(검증 계정) |
| F-S03 | FSRS · 4색 · CSAT 자체 복습 큐 | IMPLEMENTED_UNVERIFIED |
| F-S04 | 레벨 · 진단 모델 | IMPLEMENTED_UNVERIFIED |
| F-S05 | 목표 · 개인화 | PARTIAL |
| F-S06 | 교사 · B2B | PARTIAL |
| F-S07 | 결제 · 요금제 | DESIGN_ONLY |
| F-S08 | 계측(로그인 + 익명) | VERIFIED_WORKING(수집) |
| F-S09 | 리텐션 패널 | IMPLEMENTED_UNVERIFIED |
| F-S10 | 알림 · 푸시 | UNKNOWN(코드 0) |
| F-S11 | 프로덕션 배포 | PARTIAL(배포 단계 건너뜀) |
| F-S11b | CI e2e | PARTIAL(시크릿 미설정으로 건너뜀) |
| F-S12 | Admin 콘솔 87화면 | IMPLEMENTED_UNVERIFIED(목업 6) |
| F-S13 | Admin 도움말 | IMPLEMENTED_UNVERIFIED(회귀 테스트 있음) |
| F-S14 | DB 헬스 | PARTIAL |
| F-S15 | 학습 원리 → 학습자 화면 배선 | EXPERIMENTAL |
| F-S16 | 에이전트 협업 인프라 | IMPLEMENTED_UNVERIFIED |
| F-S17 | pg_cron 예약 작업 | IMPLEMENTED_UNVERIFIED(14/15 활성 · 2개 마이그레이션 밖) |

## 미병합 (F-U) · 은퇴 (F-D) — [REPOSITORY_INVENTORY.md](./REPOSITORY_INVENTORY.md)

| ID | 기능 | 상태 |
|---|---|---|
| F-U01 | design/replica-first 줄기(디자인 3B/Tines · 삽화) | UNMERGED |
| F-U02 | CSAT EC · reveal · map-vnext | UNMERGED — DB 에 EC 마이그레이션 10건 적용됨 |
| F-U03 | csat-g2-integration(#155) · learning-loop-g1 · practice-port | UNMERGED |
| F-U04 | methodology-vnext · knowledge-signals/verify | UNMERGED |
| F-U05 | 로컬 전용 worktree 브랜치(anchor-study · codex-* · ec-detector · map-core) | UNKNOWN |
| F-D01 | 고전 PD 도서 원천 | DEPRECATED |
| F-D02 | ACP arXiv | DEPRECATED |
