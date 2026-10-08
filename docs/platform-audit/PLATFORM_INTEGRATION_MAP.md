# PLATFORM_INTEGRATION_MAP — 무엇이 무엇에 연결돼 있는가

> 기준 a7c986469 · 2026-10-09. 화살표는 「코드가 실제로 읽거나 쓴다」(파일:줄 근거), ✕ 는 끊긴 연결, ○ 는 **연결은 있으나 측정 기록 0**이다.

## 1. 의도된 흐름 (PROJECT.md 의 9 모듈 사이클)

```
콘텐츠 공급 ─→ 읽기(TextViewer L0-2) ─→ 담기(WordVault L3) ─→ 재인(Flashcard·WordBlitz·PairFlip L4a)
   ─→ 생성(SpellForge L4b · EchoMatch L4c) ─→ 정복(ScriptQuiz L5) ─→ 완성(Dictation L6) ─→ 회고(Dashboard L7)
                                   ↑______________ FSRS 복습 ______________|
```

## 2. 실제 연결 (실측)

```
[공급]                                 [학습자 표면]                          [기록]                       [회고]
LCP 도서 312 ───────────────→ 라이브러리/TextViewer ──→ texts.status(completed 0 ○)
ACP 기사 published 250 ──────┘   (ready 84,715 는 미발행)
교재 공장(main: 집필·각색) ──→ /library/textbooks ─→ 연습(생성형 9유형 미지원)
VCB · 사전 ──────────→ 단어 팝업 · 단어장 ─→ Flashcard/WordBlitz/아케이드 ─→ learning_records ─→ Dashboard·FSRS
                                              SpellForge ─→ /api/srs/flush ─→ learning_records (○ 0)
                                              EchoMatch ─→ record-sound ─→ learning_records (○ 0)
                                              Dictation ─→ dictation_* + learning_records
                                              ScriptQuiz ─→ scores ─────────────────────────────→ Dashboard
CSAT 문항 분석 3,714 ─→ /csat 해설·지도 ─→ csat_item_attempts · csat_dx_response · learning_task_attempts(0)
학습자 PDF ─→ /csat 세션 ─→ csat_session_attempts(1) ─→ CSAT 자체 복습 큐     ✕ FSRS   ✕ Dashboard
일반 기사 → CTP/DCP 생성(약 834k) ─→ Practice(dcp-actions) ─→ 시도 20
학습 원리 등록부 ─→ csat/item PrinciplePanel·CohesionPanel (CSAT 에만)
영상 팩토리 73 ─→ /video(마케팅) · 교재 화면 삽입  ✕ 학습 기록
CCP 만화 ─→ /comics ─→ comic_read_progress(2)      PDCP 969 ─→ /comics/restored (ADR 0007 은 제거 결정)
CSAT 강의 대본 ─→ LectureStage(Web Speech) ✕ 학습 기록
TextFit /fit (비로그인) ─→ 결과 공유·학습지 출력 ✕ 가입 후 학습 기록
VRL 진단 ─→ 레벨 스냅샷   ·   CSAT dx ─→ csat_dx_snapshot   (척도가 다른 두 레벨 모델)
교사 classes 1 ─→ class_assignments 0 ○ 학생
```

## 3. 끊긴 연결 목록 (영향 큰 순)

| # | 끊김 | 결과 | 근거 |
|---|---|---|---|
| I1 | CSAT 기록 ✕ 공용 회고(Dashboard) · 공용 FSRS | 이벤트상 가장 활발한 표면의 학습이 공용 회고에 안 나타난다. CSAT 는 자체 복습 큐를 가진다 | `lib/learner/recent-activity-query.ts:113` · `lib/csat/session/model.ts:5` |
| I2 | 읽기 완료 기록 0 | 9 모듈 사이클의 출발점이 기록상 한 번도 닫히지 않았다 | `texts` completed 0 · `complete-chapter.ts:58` |
| I3 | SpellForge · EchoMatch 기록 0 (경로는 있음) | L4b·L4c 계층의 실제 동작이 미검증 | `flush-actions.ts:164` · `record-sound.ts:86` |
| I4 | 공급 → 학습자 미도달 | ACP ready 84,715/91,793(92.3%) 미발행 · CTP/DCP 는 「접근 가능하나 사용 없음」 | CONTENT_PIPELINE_ATLAS §2 |
| I5 | 레벨·목표 모델이 표면마다 다르다 | 척도는 달라도 학습자에게 보이는 「내 수준·내 목표」가 하나가 아니다 | PLATFORM_SHARED_SYSTEMS §3 |
| I6 | 영상·강의·TextFit ✕ 학습 기록 | 듣기·강의·비로그인 진단이 학습 루프 밖의 섬 | 위 그림 |
| I7 | 학습 원리 등록부 → CSAT 에만 | 9 모듈은 원리를 읽지 않는다 | `csat/item` PrinciplePanel |
| I8 | 교사 → 학생 과제 0행 | 10만 도달 경로로 정한 채널의 실사용이 없다. 교사 권한은 role 이 아니라 `classes.teacher_id` 소유로 판정한다(`lib/teacher/class-actions.ts:41`) | classes 1 · assignments 0 |
| I9 | main ✕ DB(마이그레이션 ≥17건 main 밖) | 저장소로 DB 를 재현할 수 없다 | REPOSITORY_INVENTORY §3 |
| I10 | main ✕ 프로덕션 | deploy·e2e 가 모두 시크릿 미설정으로 건너뛴다 | GitHub run 2026-10-08 로그 |
