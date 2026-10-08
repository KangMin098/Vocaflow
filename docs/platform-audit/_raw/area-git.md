# 영역 감사 — Git 상태 (2026-10-09, 읽기 전용)

근거: `git` (origin/main 기준) · `supabase_migrations.schema_migrations` 직접 질의 · `_raw/worktrees.txt` · `_raw/remote-branches-ahead.txt`. 브랜치·워크트리는 하나도 바꾸지 않았다.

## 1. main 이력

- origin/main 커밋 **3,777**
- 월별: 2026-04 3 · 05 87 · 06 214 · 07 528 · 08 1,243 · **09 1,510** · 10(9일까지) 192
- 타입: feat 1,609 · fix 1,100 · docs 550 · chore 147 · test 104 · perf 54 · refactor 52
- 상위 scope: csat 652 · textbook 570 · dict 201 · comic 164 · acp 140 · admin 115 · design 112 · vocab 97 · pdcp 86 · lcp 82 · db 82 · vcb 71 · compose 64 · scriptquiz 48 · library 48
  - 공급 파이프라인(csat 원문·textbook·dict·comic·acp·pdcp·lcp·vcb) scope 가 학습자 모듈 scope 를 압도한다.

## 2. main 보다 앞선 원격 브랜치 55개 — 핵심 판정

### 2-1. 마이그레이션 위험 (DB 적용 여부 = schema_migrations 실측)

| 버전 | 파일 | 실린 브랜치 | main | DB |
|---|---|---|---|---|
| 20260926120000 | spelling_canonical | replica-first 계열 9개 | 없음(main 엔 `_pending_spelling_canonical.sql`) | **미적용** |
| 20260929090000 | funnel_allow_csat_workspace | replica-first 계열 | 없음 | **미적용** |
| 20261002120000/120100/130000 | csat_map · funnel_allow_csat_map · item_rate_ledger | replica-first 계열 + map/ec | main 에 있음 | **미적용**(이 버전명으로는 없음 — main 파일인데 DB 미기록, 확인 필요) |
| 20261003230000 · 1005xxxx · 1006xxxx (10건) | EC/reveal 계열 | ec-smoke · ec-reveal-app · reveal-gate-verify · map-vnext(일부) | 없음 | **적용됨** — DB 에는 있고 main 에는 없다(드리프트) |
| 20261007102816 … 20261007213310 (5건) | reading_adaptation_promotion_gate 등 교재 | textbook-factory-phase1 · design/replica-first | 없음 | **적용됨**(main 미반영 드리프트) |
| **20261008120000** | **reading_production_snapshot** (textbook-factory-phase1) | textbook-factory-phase1 | main 의 같은 번호는 `knowledge_vnext` | DB 의 20261008120000 = knowledge_vnext → **번호 충돌, 교재 쪽 미적용**. 번호 재부여 필요 |
| 20261008144206 | knowledge_release_approval | knowledge-signals | 없음 | 적용됨 |
| 20261008180000 | learning_help_timing | csat-g2-integration (PR #155) | 없음 | 적용됨 |
| 20260920014500 / 024000 | anon 하드닝 | db-anon-160-161 (#117) · db-anon-exec-hardening (#116) | 014500 은 main 에 있음 | 둘 다 이 버전으로는 미기록 |
| 20260719…20260720 (7건) | dict 커버리지 | feat/plan-ui (7월) | 없음 | 미기록 |
| 20260628120000 | p6_enroll_i_plus_one | feat/p6-enroll-i-plus-one | main 에 있음 | 미기록 |

- knowledge-vnext vs methodology-vnext: 둘 다 `20261008120000_knowledge_vnext.sql`. main·DB 에 이미 들어간 것은 methodology-vnext 쪽 계보(main 에 20261008140000~170000 이어짐). knowledge-vnext 브랜치는 동결 결정 문서가 마지막 커밋 → superseded.
- **DB 에 적용됐는데 main 에 없는 마이그레이션 ≥17건**(EC 10 · 교재 5 · knowledge 1 · G2 1). 해당 브랜치를 버리면 저장소에서 스키마 출처가 사라진다.

### 2-2. 큰 통합 줄기 (design/replica-first 계보)

`design/replica-first`(255, 현재 주 작업 브랜치·워크트리 dirty 243) 위에 `textbook-factory-phase1`(289) · `design/illo-quality`(212) · `fix/admin-touch-target`(163) · `fix/vocab-modal-count`(156) · `feat/learner-finish`(140) · `feat/bespoke-heads`(126) · `feat/body-composition`(110) 이 서로 merge 로 얽혀 있다. 같은 5개 마이그레이션과 apps/web 270~300파일을 공유 — 개별 PR 이 아니라 replica-first 하나로 합쳐야 하는 한 덩어리. 분기 기준 2주 정책: replica-first 는 9/26 이전 분기로 **정책 초과**(behind 38).

EC/CSAT 학습자 줄기: `feat/ec-smoke`(167) ⊃ `feat/ec-reveal-app`(156) ⊃ `feat/reveal-gate-verify-20261006`(147), `feat/map-vnext`(100). map-vnext vs ec-smoke: 둘 다 20261002·20261003230000 을 갖고 apps/web csat 를 겹쳐 고친다(메모리 규칙: 지도=map-vnext, Pilot=ec-smoke, cherry-pick 으로 이동).

## 3. 브랜치별 표 (ahead|최종커밋|브랜치|behind|변경파일|추가 마이그레이션|상위 경로|최근 커밋)

분류 기준: 활성 = 최근 2주 내 커밋 · stale = 2주 초과 · abandoned = 3개월 가까이 방치·이후 main 이 같은 기능 보유 · superseded = 내용이 main 에 이미 있거나 대체됨.

| 분류 | 브랜치 |
|---|---|
| UNMERGED-active (주 줄기) | design/replica-first · feat/textbook-factory-phase1 · design/illo-quality · fix/admin-touch-target · fix/vocab-modal-count · feat/learner-finish · feat/bespoke-heads · feat/body-composition |
| UNMERGED-active (CSAT 학습자/지식) | feat/ec-smoke · feat/ec-reveal-app · feat/reveal-gate-verify-20261006 · feat/map-vnext · feat/csat-g2-integration(PR #155) · fix/map-transfer-skeleton(PR #156, 변경 0파일 — 머지 커밋만 남음, 사실상 반영됨) · feat/knowledge-signals · feat/knowledge-verify · feat/methodology-vnext · feat/csat-learning-loop-g1 · feat/csat-practice-port · docs/csat-vnext-audit · feat/csat-origin-followup-20261004 |
| UNMERGED-stale (9/18~10/02) | claude/elegant-cannon-jhkyts(224, 드레인 출력 파일 688개 — 데이터 커밋 묶음) · feat/knowledge-essence(PR #140) · fix/analyst-guidance · feat/ebsi-wrong-rate · chore/agents-roundtrip-safety(PR #122) · design/token-color-ratchet · claude/laughing-goodall-t4lk9i · feat/motion-d · feat/screen-redesign(워크트리 dirty 23) · feat/ux-audit · feat/design-workflow-20260918 · design/admin-gate4-evidence · chore/band-consensus-measure · claude/tines-design-platform-cmkflo |
| already-superseded | feat/knowledge-vnext(동결, 같은 번호를 main 이 methodology 계보로 보유) · fix/db-anon-exec-hardening(#116, 014500 이 main 에 있음) · feat/db-anon-160-161(#117, 같은 014500 포함 + 024000 미적용 — 재검토 필요) · feat/csat-source-policy-v3 ⊂ feat/csat-corpus-expansion(9/19, 20260918140224·20260919023622 는 DB 적용) · feat/p6-enroll-i-plus-one(마이그레이션 main 에 있음) |
| likely-abandoned (6~7월) | feat/plan-ui(7/20, dict 마이그레이션 7건 미기록) · claude/intelligent-davinci-2kwbR(labs/claw-poc) · feat/wordvault-study-real-a2 · chore/worktree-automation · chore/tier-b-quickfixes · chore/lint-cleanup · fix/next-build-onnxruntime · feat/wordblitz-learning-records · feat/srs-persistence-a1 · fix/vcb-step5-stale-detection(5/17) · feat/wordvault-review-a2b · feat/acp-curation-guide · chore/gitignore-turbo · chore/reading-room-tier2-navy-unify — 대부분 이후 PR(#36~#45 등)로 main 에 들어간 흔적(최근 커밋 메시지에 PR 번호), ahead 1~3 은 머지 커밋/잔여 |

### 원자료
```
289|2026-10-08|origin/feat/textbook-factory-phase1|behind=38|files=758|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261007102816 20261007102922 20261007205705 20261007211638 20261007213310 20261008120000 |apps/web(308) scripts/textbook(171) scripts/csat(90) |docs(textbook): distinguish pipelin
255|2026-10-08|origin/design/replica-first|behind=38|files=703|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261007102816 20261007102922 20261007205705 20261007211638 20261007213310 |apps/web(301) scripts/textbook(142) scripts/csat(90) |feat(textbook): revalidate live production evidence;feat(t
224|2026-10-01|origin/claude/elegant-cannon-jhkyts|behind=250|files=705|mig=|scripts/csat(688) docs/source-check(4) docs/reports(4) |chore: 체크리스트 드레인 판정자 출력 저장 — 1파일;chore: 체크리스트 드레인 판정자 출력 저장 — 2파일;chore: 체크리스트 드레인 판정자 출력 저장 �
212|2026-10-07|origin/design/illo-quality|behind=56|files=619|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(291) scripts/csat(90) scripts/textbook(89) |fix(design): Colab 노트북 — 계산(latent)과 그리기를 나눠 메모리 부족(-9) 회피;fix(design): Colab 노트북 — Dri
167|2026-10-07|origin/feat/ec-smoke|behind=38|files=601|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261003230000 20261005130000 20261005150000 20261005170000 20261005170100 20261006090000 20261006100000 20261006110000 20261006120000 |apps/web(248) scripts/csat(174) docs/csat-learner(84) |feat
163|2026-10-05|origin/fix/admin-touch-target|behind=56|files=572|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(278) scripts/csat(90) scripts/textbook(63) |merge: fix/admin-touch-target 를 design/replica-first 에 (touch-target 판정 · public-sweep lint);docs(textbook): record F02 pil
156|2026-10-07|origin/feat/ec-reveal-app|behind=38|files=553|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261003230000 20261005130000 20261005150000 20261005170000 20261005170100 20261006090000 |apps/web(237) scripts/csat(153) docs/csat-learner(81) |docs: reconstruct CSAT gate lineage and G6 r
156|2026-10-05|origin/fix/vocab-modal-count|behind=56|files=561|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(275) scripts/csat(90) scripts/textbook(56) |merge: design/replica-first 최신(교재 F02 10커밋)을 vocab-modal-count 에;chore: integrate F02 calibration with learner PC upd
147|2026-10-06|origin/feat/reveal-gate-verify-20261006|behind=38|files=544|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261003230000 20261005130000 20261005150000 20261005170000 20261005170100 20261006090000 |apps/web(237) scripts/csat(150) docs/csat-learner(80) |fix: prepare production assets
140|2026-10-05|origin/feat/learner-finish|behind=56|files=546|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(271) scripts/csat(90) scripts/textbook(46) |merge: design/replica-first 최신(교재 8커밋)을 learner-finish 에 — 학습자 PC 기준선 기록;feat(textbook): re-review F0
126|2026-10-05|origin/feat/bespoke-heads|behind=56|files=528|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(265) scripts/csat(90) scripts/textbook(37) |merge: design/replica-first 최신(교재 10커밋)을 bespoke-heads 에 — CHANGELOG 양쪽 보존;feat(textbook): gate reading adapta
110|2026-10-05|origin/feat/body-composition|behind=56|files=507|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 |apps/web(262) scripts/csat(90) scripts/textbook(28) |feat(design): bespoke 머리 이행 1차 — 연습·구문 연습·전체 보기;chore(web): 쓰이지 않는 VocabShelf3D 제거 �
100|2026-10-08|origin/feat/map-vnext|behind=38|files=451|mig=20260926120000 20260929090000 20261002120000 20261002120100 20261002130000 20261003230000 |apps/web(221) scripts/csat(137) docs/csat-learner(29) |feat(csat-diagnosis): M2409 pilot canon 활성화(PILOT_CANON_ACTIVE);fix(csat-map): 관찰된 S 가 1위면 직접 확인�
40|2026-09-19|origin/feat/screen-redesign|behind=656|files=339|mig= |docs/design(194) apps/web(137) .agents/skills(2) |docs(design): /scriptquiz 골든 17호 고정 — DD-37 · 장부 상태는 계약 테스트;feat(scriptquiz): 읽은 것 확인하기를 읽은 챕터 장부로;docs(design): /dictate 골든 16호 �
39|2026-10-06|origin/feat/csat-origin-followup-20261004|behind=56|files=34|mig=|docs/reports(20) scripts/csat(8) docs/LIBRARY_PIPELINE.md(1) |docs(csat): clarify unfinished Books web query recovery;docs(csat): preserve Books web cohort and blocked preflight;fix(csat): bind registered bibliography to retrieval evidence;
38|2026-10-08|origin/feat/csat-g2-integration|behind=3|files=72|mig=20261008180000  |apps/web(39) docs/csat-learner(18) scripts/knowledge(3) |fix(csat): G2 전 직접 기록의 실효 도움 NULL 은 저장값으로 (Codex P2);fix(db,admin): F7 실제 기록 수정 불가 · 재계산 표시 · 실효 도움 판정;fix(db,csat):
16|2026-10-08|origin/feat/methodology-vnext|behind=9|files=8|mig=|scripts/knowledge(5) docs/methodology(2) docs/CHANGELOG.md(1) |docs(methodology): F7 5af744d2 최종 검사 — probe 전부 통과 · 승인 요청 가능;test(methodology): F7 probe ⑥ 실제 시도 수정 · ⑦ 재검토 표시 해제 — fa1c952b 에서 재
16|2026-10-08|origin/feat/knowledge-vnext|behind=38|files=43|mig=20261008120000 |apps/web(28) scripts/knowledge(5) docs/methodology(3) |docs(methodology): 공유 SQL 통합 방향 결정 기록(수행 기록·이벤트 제약);docs(methodology): vNext 통합 결정 기록 — 이식 담당·115문항 격리·브랜치 동결;doc
13|2026-10-08|origin/feat/csat-learning-loop-g1|behind=35|files=36|mig=|docs/csat-learner(17) apps/web(14) scripts/csat(2) |docs(csat-learner): G2 M8(help_received_at) 제안 패치 보관 — 미적용 · 채택은 사용자/methodology 결정;docs(csat-learner): G2 통합 SQL da627938 적용 전 독립 심사 — CONDITI
12|2026-10-08|origin/feat/knowledge-verify|behind=32|files=8|mig=|scripts/knowledge(4) docs/methodology(3) docs/CHANGELOG.md(1) |fix(knowledge): 실DB 동시성 시험 정리 — 원장 열 · 실행 소유 확인 · dryRun;docs(methodology): B7 판정 조건 보강 — 일시 중단만으로 통과 아님 · 서버 측 강제;
9|2026-10-08|origin/feat/knowledge-signals|behind=8|files=33|mig=20261008144206 |apps/web(26) supabase/migrations(1) scripts/knowledge(1) |docs(knowledge): 노출 중단 · B7 · 적용 초안 8행 DB 반영 기록;feat(admin): 적용 켜기 = B7 출시 승인 — 사유 필수 · 승인 기록;feat(db): B7 출시 승인 가드 
9|2026-07-20|origin/feat/plan-ui|behind=3052|files=37|mig=20260719120000 20260719130000 20260719140000 20260720100000 20260720110000 20260720120000 20260720130000 |scripts/dict(13) supabase/migrations(7) apps/web(7) |fix(dict): select_coverage_for_words core-제외 가드 — 세 경로 일관;feat(dict): 참고 목록 굴절 �
6|2026-10-08|origin/docs/csat-vnext-audit|behind=35|files=7|mig=|docs/csat-learner(6) docs/CHANGELOG.md(1) |docs(csat-learner): vnext — 2차 심사 판정·수정 필수 5건 기록, 라우트표 잔존 표현 정정;docs(csat-learner): vnext — 공통 규격 3안 「채택 방향」 사용자 결정 기
6|2026-09-19|origin/feat/csat-corpus-expansion|behind=658|files=102|mig=20260918140224 20260918141948 20260918222517 20260918232551 20260919023610 20260919023620 20260919023622 |apps/web(32) packages/library-pipeline(19) docs/reports(11) |feat(csat): add measured corpus discovery and guarded pilot import;docs(csat): record final
5|2026-09-19|origin/feat/csat-source-policy-v3|behind=658|files=66|mig=20260918140224 20260918141948 20260918222517 20260918232551 |apps/web(26) packages/library-pipeline(12) docs/reports(7) |docs(csat): record final validation and draft delivery;fix(csat): align committed learner pages with design guards;fix(csat): unify source
4|2026-10-08|origin/feat/csat-practice-port|behind=56|files=27|mig=|apps/web(21) scripts/audit(2) docs/csat-learner(1) |fix(csat): practice 해설 열람을 시도 payload 밖으로 — g2 재전송 conflict 제거;fix(csat): practice 판단 뒤 해설을 열면 답 잠금 — 수정 답의 독립 수행 오분류 차�
4|2026-10-01|origin/feat/knowledge-essence|behind=87|files=4|mig=|scripts/knowledge(2) docs/methodology(1) docs/CHANGELOG.md(1) |chore: origin/main 병합 — CHANGELOG 충돌 정리;fix: 본질 지도 적재 스크립트를 keyset 페이징으로 (OFFSET 예산 회귀);Merge pull request #141 from KangMin098/feat/csat-diagnosi
4|2026-09-26|origin/design/token-color-ratchet|behind=579|files=16|mig=|apps/web(9) packages/design-tokens(2) docs/reports(2) |fix(design): PR #118 리뷰 — ios-indigo 매핑 제거 · 금지색 파서·키 보강;feat(design): 라쳇을 토큰까지 — 금지색을 이름이 아니라 색상환으로 검사;chore: 검사 
4|2026-09-18|origin/feat/ux-audit|behind=663|files=91|mig=|docs/design(91) |docs(ux-audit): Gate 3 판정 + Gate 5 브리프·우선순위 — 감사 완료;docs(ux-audit): Gate 1 연결·여정 + Gate 2 카드 5영역;docs(ux-audit): Gate 4 — 참고 자료·도구 실측, 
4|2026-07-01|origin/claude/intelligent-davinci-2kwbR|behind=3473|files=18|mig=|labs/claw-poc(18) |feat(labs/claw-poc): 샤방샤방 파스텔 카와이 재설계;feat(labs/claw-poc): 정면 뷰 + 아케이드 컨트롤 + 사진 색감/디테일 매칭;feat(labs/claw-poc): 실제 Catching Duck 오�
3|2026-06-28|origin/feat/wordvault-study-real-a2|behind=3533|files=8|mig=|apps/web(6) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |Merge remote-tracking branch 'origin/main' into feat/wordvault-study-real-a2;feat(srs): 학습 결과 DB 영속화 — sessionStorage 큐 flush (A1.1) (#38);chore: 추적 중인 .turbo 캐시 파일 u
3|2026-06-28|origin/chore/worktree-automation|behind=3537|files=7|mig=|scripts/worktree.mjs(1) package.json/(1) docs/WORKTREE.md(1) |Merge remote-tracking branch 'origin/main' into chore/worktree-automation;chore(lint): ESLint 에러 74건 cleanup → verify CI green (#42);fix(build): 프로덕션 next build 복구 (swcMinify + 
3|2026-06-28|origin/chore/tier-b-quickfixes|behind=3536|files=5|mig=|apps/web(3) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |Merge remote-tracking branch 'origin/main' into chore/tier-b-quickfixes;chore: 멀티 세션 git worktree 자동화 (worktree.mjs + 가이드) (#36);Merge remote-tracking branch 'origin/main' into cho
3|2026-06-28|origin/chore/lint-cleanup|behind=3538|files=36|mig=|apps/web(30) packages/vcb-core(1) packages/library-pipeline(1) |fix(test): content-storage 통합테스트 env 없는 CI에서 정상 skip;chore(ci): verify green 복구 — mobile lint/typecheck stub + 무테스트 패키지 passWithNoTests;chore(lint): ESLint �
2|2026-10-08|origin/fix/map-transfer-skeleton|behind=1|files=0|mig=||fix(map): 전이 조회 실패 시 연습 결과는 유지 (Codex P1);fix(map): 다른 지문 적용에 골격 전이(<key>-skeleton)도 센다;Merge pull request #154 from KangMin098/feat/map-feedbac
2|2026-09-25|origin/claude/laughing-goodall-t4lk9i|behind=573|files=4|mig=|docs/CHANGELOG.md(1) .githooks/pre-commit(1) .claude/settings.json(1) |chore: .githooks/pre-commit 실행 권한 기록 (644 → 755);chore: cloud 세션 시작 시 의존성 자동 설치 훅 추가;Merge pull request #114 from KangMin098/docs/csat-type-
2|2026-09-23|origin/feat/motion-d|behind=423|files=7|mig=|apps/web(5) docs/design(1) docs/CHANGELOG.md(1) |Merge remote-tracking branch 'origin/design/replica-first' into feat/motion-d;feat(design): D 단계 — 앰비언트 모션을 공개 화면으로 (tines-mapping §29-12);docs(db): 조치 뒤 테스�
2|2026-09-20|origin/feat/db-anon-160-161|behind=580|files=6|mig=20260920014500 20260920024000 |supabase/migrations(2) scripts/db(2) docs/DB_SCHEMA.md(1) |fix(db): 신설 정의자 함수 2종의 anon 노출을 걷는다 (발견 160·161);fix(db): 익명 사용자가 영상 큐에 쓰던 구멍을 막는다 (발견 104·112);docs
2|2026-09-20|origin/design/admin-gate4-evidence|behind=579|files=12|mig=|apps/web(7) docs/reports(2) packages/design-tokens(1) |chore: 검사 실행으로 재생성된 리포트 2건;feat(admin): evidence 에 「정오표」 렌즈 · Tailwind 이관 · 44px 루트 보장 (Gate 4 (ii) · DD-61);Merge pull request #112 from Kan
2|2026-09-20|origin/chore/band-consensus-measure|behind=589|files=3|mig=|scripts/csat(1) docs/reports(1) docs/design(1) |docs(design): DD-57 정정 — 「수능이 상한과 어긋난다」는 신호 하나짜리 결론이었다;measure(csat): 기출 난이도 3중 합의 재측정 — 어휘 0.5 + 가독성 0.3;Merge 
2|2026-06-28|origin/fix/next-build-onnxruntime|behind=3539|files=8|mig=|docs/AI_CONTEXT(4) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |ci: next build 회귀 가드 job 추가;fix(build): 프로덕션 next build 복구 (swcMinify + eslint 분리);Merge pull request #35 from KangMin098/feat/voa-curation-redesign;
2|2026-06-28|origin/feat/wordblitz-learning-records|behind=3532|files=3|mig=|docs/CONTEXT.md(1) docs/CHANGELOG.md(1) apps/web(1) |Merge remote-tracking branch 'origin/main' into feat/wordblitz-learning-records;feat(wordvault): study 실 vocabularies + SRS 영속화 (A2) (#39);feat(srs): 학습 결과 DB 영속화 — sessionStor
2|2026-06-28|origin/feat/srs-persistence-a1|behind=3534|files=10|mig=|apps/web(7) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |Merge remote-tracking branch 'origin/main' into feat/srs-persistence-a1;chore: 추적 중인 .turbo 캐시 파일 untrack (#43);fix(ui): Tier B 미완성 작업 폴리시 (pending-words toast + 로딩
2|2026-05-17|origin/fix/vcb-step5-stale-detection|behind=3741|files=7|mig=|scripts/vcb(3) packages/vcb-curate-core(2) apps/web(2) |feat(vcb): bulk-approve + promote-to-dict + cefr-relabel + publish pagination fix;fix(admin-vcb): detect + recover stale Step 5 pending chunks;docs(vcb): §19 admin UI coverage patch proposal (P5c.7~
1|2026-10-02|origin/fix/analyst-guidance|behind=56|files=2|mig=|.codex/agents(1) .claude/agents(1) |chore(csat): 분석 에이전트 지시에 학평 검수가 반복 반려한 7가지 추가;Merge pull request #147 from KangMin098/fix/ledger-note-only;fix(csat): reject incomplete ledger annotations
1|2026-10-02|origin/feat/ebsi-wrong-rate|behind=61|files=6|mig=|scripts/csat(3) package.json/(1) docs/reports(1) |feat(csat): EBSi 오답률 TOP15 원장 추가;Merge pull request #144 from KangMin098/fix/analysis-import-guards;fix(csat): preserve active recovery after omitted results;
1|2026-09-26|origin/chore/agents-roundtrip-safety|behind=240|files=7|mig=|agents/scripts(4) docs/CHANGELOG.md(1) agents/router.md(1) |feat(agents): Claude ↔ Codex 왕복 안전장치 — 낡은 가드 경고 · 마이그레이션 번호 중복 검사;Merge pull request #119 from KangMin098/feat/video-requests;Merge origin/main
1|2026-09-20|origin/fix/db-anon-exec-hardening|behind=580|files=4|mig=20260920014500 |supabase/migrations(1) scripts/db(1) docs/DB_SCHEMA.md(1) |fix(db): 익명 사용자가 영상 큐에 쓰던 구멍을 막는다 (발견 104·112);docs: CHANGELOG 줄 복원 — 셸 백틱에 먹힌 토큰 이름;docs(design): DD-59 — Gate 4 
1|2026-09-20|origin/claude/tines-design-platform-cmkflo|behind=573|files=4|mig=|docs/design(3) docs/CHANGELOG.md(1) |docs(design): Tines 레퍼런스 판정 — 방법만 채택, 스타일 토큰 거부 (DD-61);Merge pull request #114 from KangMin098/docs/csat-type-difficulty;Merge pull request #113 from KangMin098/
1|2026-09-18|origin/feat/design-workflow-20260918|behind=663|files=14|mig=|apps/web(6) docs/design(2) .agents/skills(2) |feat: add Vocaflow design workflow and visual QA;feat(textbook): 「글의 목적」 V7 서신 30편 · 합본 A5 16/16 달성;feat(csat): 세션 풀이 기록을 서버에 — 마이그레이션 2건
1|2026-06-28|origin/feat/wordvault-review-a2b|behind=3531|files=6|mig=|apps/web(3) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |feat(wordvault): 복습 뷰 실데이터 — /wordvault/review RSC (A2b);feat(wordblitz): learning_records 적재 추가 (A1.3) (#40);feat(wordvault): study 실 vocabularies + SRS 영속화 (A2) (#39)
1|2026-06-28|origin/feat/p6-enroll-i-plus-one|behind=3530|files=6|mig=20260628120000 |supabase/migrations(1) docs/DB_SCHEMA.md(1) docs/CONTEXT.md(1) |feat(srs): 책 구독 시 i+1 필터 — _enroll_book_subscribe_word_sets (P6.1/C1);feat(wordvault): 복습 뷰 실데이터 — /wordvault/review RSC (A2b) (#45);feat(wordblitz): 
1|2026-06-28|origin/feat/acp-curation-guide|behind=3508|files=7|mig=|apps/web(5) docs/CONTEXT.md(1) docs/CHANGELOG.md(1) |fix(curation): StoryWeaver 소스 GET 영어만 — 다국어 혼입 차단;docs(learner): 학습자 관리 설계 SSoT (LEARNER_MANAGEMENT.md) (#61);Merge pull request #60 from KangMin098/feat/voa-cu
1|2026-06-28|origin/chore/gitignore-turbo|behind=3535|files=3|mig=|packages/library-pipeline(1) docs/CONTEXT.md(1) .turbo/preferences(1) |chore: 추적 중인 .turbo 캐시 파일 untrack;fix(ui): Tier B 미완성 작업 폴리시 (pending-words toast + 로딩 화면) (#37);chore: 멀티 세션 git worktree 자동화 (worktree.m
1|2026-06-21|origin/chore/reading-room-tier2-navy-unify|behind=3548|files=4|mig=|apps/web(3) docs/CONTEXT.md(1) |feat(ui): Reading Room 2차 — 모듈 hub 배너 + 진단카드/CTA navy 통일;Merge pull request #33 from KangMin098/chore/reading-room-tier1-compliance;feat(ui): Reading Room 1차 정합 복구 �
```

## 4. 워크트리 48개 (dirty = status --porcelain 줄 수)

```
243 D:/workspace/Vocaflow 8cd15b7b6 [design/replica-first]
2 D:/workspace/Vocaflow-admin-dashboard-v2 898ce5b28 [design/admin-dashboard-v2]
0 D:/workspace/Vocaflow-anchor-study e70a0c0d5 [feat/anchor-study]
0 D:/workspace/Vocaflow-benchmark-admission-integration-20261006 6f216219f [feat/textbook-factory-phase1]
3 D:/workspace/Vocaflow-body-composition 0c52f52d3 [design/illo-quality]
0 D:/workspace/Vocaflow-codex-backlog-20260926 2685f6d2c [feat/codex-backlog-20260926]
0 D:/workspace/Vocaflow-codex-pr142-144 194805900 [review/csat-pr142-144-20261002]
0 D:/workspace/Vocaflow-codex-pr142-final 1c417ce46 [fix/analysis-import-sync-20261002]
0 D:/workspace/Vocaflow-codex-pr146-20261002 ee31c4b5c [fix/ledger-note-review-20261002]
2 D:/workspace/Vocaflow-csat-corpus-expansion b7f9cf167 [feat/csat-corpus-expansion]
0 D:/workspace/Vocaflow-csat-g1 410e43191 [feat/csat-learning-loop-g1]
0 D:/workspace/Vocaflow-csat-origin-followup-20261004 3d2f46b4f [feat/csat-origin-followup-20261004]
0 D:/workspace/Vocaflow-csat-practice-port 54aa73186 [feat/csat-practice-port]
0 D:/workspace/Vocaflow-csat-quote-guard b2693f93f [fix/csat-item-quote-guard]
1 D:/workspace/Vocaflow-csat-source-policy-v3 98b24044a [feat/csat-source-policy-v3]
0 D:/workspace/Vocaflow-csat-sources bf9703605 [feat/csat-sources-workspace]
0 D:/workspace/Vocaflow-csat-vnext-audit f73c102eb [docs/csat-vnext-audit]
1 D:/workspace/Vocaflow-db-anon-160-161 340545e06 [feat/db-anon-160-161]
0 D:/workspace/Vocaflow-design-workflow f7579129f [feat/design-workflow-20260918]
0 D:/workspace/Vocaflow-ebsi-wrong-rate 055933d00 [feat/ebsi-wrong-rate]
3 D:/workspace/Vocaflow-ec-detector b589d04a8 [feat/ec-detector]
0 D:/workspace/Vocaflow-ec-e2e 602e5836a [test/ec-pilot-e2e]
0 D:/workspace/Vocaflow-ec-gate 93d534ed3 [feat/ec-pilot-gate]
0 D:/workspace/Vocaflow-ec-reveal 26de1d55b [feat/ec-reveal-app]
11 D:/workspace/Vocaflow-ec-smoke 9380c68c8 [feat/ec-smoke]
2 D:/workspace/Vocaflow-evidence bc0ef2b5a [design/evidence-v2]
0 D:/workspace/Vocaflow-factory 1d81d8c04 [feat/factory]
2 D:/workspace/Vocaflow-g2-int 1fbac2f11 [feat/csat-g2-integration]
0 D:/workspace/Vocaflow-hakpyeong 69a31600d [fix/hakpyeong-drain-20261004]
0 D:/workspace/Vocaflow-knowledge-essence 4d145add5 [feat/knowledge-essence]
2 D:/workspace/Vocaflow-knowledge-signals 577a98e4c [feat/knowledge-signals]
1 D:/workspace/Vocaflow-knowledge-verify 1d4062250 [feat/knowledge-verify]
3 D:/workspace/Vocaflow-knowledge-vnext 08f2dffb8 [feat/knowledge-vnext]
4 D:/workspace/Vocaflow-map-core a2dd93d3a [feat/map-core]
1 D:/workspace/Vocaflow-map-feedback d5dcb3503 [fix/map-transfer-skeleton]
1 D:/workspace/Vocaflow-map-goal-first 38526f1cf [feat/map-goal-first]
3 D:/workspace/Vocaflow-map-vnext 981e75083 [feat/map-vnext]
1 D:/workspace/Vocaflow-map-vnext-integration 1169b1c14 [feat/map-vnext-integration]
11 D:/workspace/Vocaflow-methodology d8bfc6219 [feat/methodology-intelligence]
2 D:/workspace/Vocaflow-methodology-vnext a8840217d [feat/methodology-vnext]
2 D:/workspace/Vocaflow-motion-d 898aefb2a [feat/motion-d]
1 D:/workspace/Vocaflow-platform-audit a7c986469 [audit/platform-goal]
0 D:/workspace/Vocaflow-pr155-verify 6279c4123 (detached HEAD)
2 D:/workspace/Vocaflow-practice-verify2 54aa73186 (detached HEAD)
0 D:/workspace/Vocaflow-reveal-gate-verify-20261006 dbf2fadf5 [feat/reveal-gate-verify-20261006]
23 D:/workspace/Vocaflow-screen-redesign df6a599f1 [feat/screen-redesign]
0 D:/workspace/Vocaflow-ux-audit 1037dc4dd [feat/ux-audit]
0 D:/workspace/Vocaflow-video-requests 45bb3cbba [feat/video-requests]
```

- dirty 워크트리 27/48. 큰 것: Vocaflow(본, replica-first) 243 · screen-redesign 23 · ec-smoke 11 · methodology(intelligence) 11.
- detached HEAD 2개(pr155-verify · practice-verify2) — 검증용 임시, 제거 후보.
- 원격 ahead 목록에 없는 로컬 전용 브랜치 워크트리 다수(anchor-study · codex-* · ec-detector · ec-gate · factory · map-core · map-goal-first · map-vnext-integration · methodology-intelligence · video-requests 등) — origin 대비 별도 확인 필요.

## 5. 결론

1. 정책(브랜치 ≤2주) 위반: 55개 중 활성 21개 외 34개가 2주 초과. 6~7월 브랜치 14개는 정리(삭제) 후보.
2. **DB-저장소 드리프트**: DB 적용 마이그레이션 ≥17건이 main 에 없다. replica-first·ec-smoke·textbook-factory·g2 를 main 에 들이기 전까지 main 으로 DB 를 재현할 수 없다.
3. **번호 충돌 1건 실재**: textbook-factory-phase1 의 `20261008120000_reading_production_snapshot` ↔ main·DB 의 `knowledge_vnext`.
4. 미적용 마이그레이션이 활성 줄기에 실린 채 이동 중: 20260926120000 · 20260929090000 · 20261002120000/120100/130000(마지막 3건은 main 에도 있는데 DB 미기록 — 다른 버전명으로 적용됐는지 확인 필요).
5. 개발 활동은 9월 정점(1,510) 이후 10월에도 하루 ~21커밋. scope 는 공급(csat·textbook·dict·comic·acp) 편중.
