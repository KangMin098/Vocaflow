# 화면 전수 목록 (Gate 0)

> 생성 2026-09-18 · Claude Code · 근거 `apps/web/src/app/**/page.tsx` 전수(api 제외, 메인 워크트리 읽기 전용) — 스크립트는 [PROGRESS.md](PROGRESS.md) 「재현」.

**157화면** = 공개 14 · 학습자 46 · 세션 7 · 관리자 60 · redirect 5 · 게임 21 · 개발 4.

이후 게이트 대상 **127** (카드 67 + 관리자 압축 표 60). 제외 30 — redirect 5(보여 주는 것 없음) · 게임 21(아케이드 예외) · 개발 4(개발 도구).

셈법(A2): 라우트 그룹 `(…)` 은 경로에서 제거 · 동적 라우트는 1개 · parallel/intercepting route 는 **0개**(저장소에 없음) · `loading/error/not-found` 는 화면이 아니라 상태.

`@form` = 골격 선언(form-declaration-ratchet). 선언이 있는 화면은 5개뿐이다.

## ROUTES.md 와 코드의 차이

- 코드에만 있음 27: `/play/cascade` · `/play/connections` · `/play/daily-blitz` · `/play/ghost-race` · `/play/glyph-tongue` · `/play/letter-forge` · `/play/lexicon-detective` · `/play/lexicon-estate` · `/play/lexicon-hands` · `/play/morpheme-rules` · `/play/morphmerge` · `/play/silent-rule` · `/play/word-customs` · `/play/word-economy` · `/play/word-orrery` · `/play/wordfall-cadence` · `/play/wordsmith-vigil` · `/arcade/ranking` · `/practice/dcp` · `/wordvault/review` · `/wordvault/study` · `/admin/compose` · `/admin/kice/plan` · `/admin/kice/predict` · `/admin/pd-comics/reader/[*]` · `/admin/vocab/collections` · `/dev/directions`
- 문서에만 있음 7: `/manage` · `/sitemap.xml` · `/reading/[*]` · `/csat/drill` · `/csat/overlay` · `/predict` · `/admin/textbook/sources` — `/sitemap.xml` 은 page 가 아닌 route 파일. 나머지는 지워졌다고 적은 문장인지 ROUTES.md 에서 확인 필요(이 감사는 문서를 고치지 않는다)

## 공개 — 14

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S001 | `/` | public | — | 측정 중 | — | 채색 지문 | loading/error/not-found | 19 |
| S002 | `/about` | public | — | 측정 중 | — | — | — | 5 |
| S003 | `/fit` | public | — | 측정 중 | — | 채색 지문 | — | 29 |
| S004 | `/fit/s/[payload]` | public | — | 측정 중 | pending | — | — | 21 |
| S005 | `/join/[code]` | public | — | 측정 중 | pending | — | — | 6 |
| S006 | `/login` | public | — | 불필요 | — | — | — | 9 |
| S007 | `/pricing` | public | — | 측정 중 | — | — | — | 8 |
| S008 | `/privacy` | public | — | 측정 중 | — | — | — | 2 |
| S009 | `/reset-password` | public | — | 불필요 | — | — | — | 7 |
| S010 | `/signup` | public | — | 불필요 | — | — | — | 10 |
| S011 | `/terms` | public | — | 측정 중 | — | — | — | 2 |
| S012 | `/verify-email` | public | — | 불필요 | — | — | — | 6 |
| S013 | `/video` | public | — | 측정 중 | — | — | — | 5 |
| S014 | `/video/[id]` | public | — | 측정 중 | pending | — | — | 5 |

## 허브·대시보드·계획·설정 — 12

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S021 | `/dashboard` | learner | L7 | 필요 | — | 환경 변형 | — | 39 |
| S022 | `/diagnostic` | learner | — | 측정 중 | — | — | — | 20 |
| S023 | `/diagnostic/history` | learner | — | 측정 중 | — | — | — | 16 |
| S028 | `/hub` | learner | — | 측정 중 | — | 망각 | — | 44 |
| S029 | `/hub-lab` | learner | — | 측정 중 | — | — | — | 47 |
| S043 | `/plan` | learner | — | 측정 중 | — | — | — | 21 |
| S044 | `/practice` | learner | — | 측정 중 | — | — | — | 32 |
| S045 | `/practice/dcp` | learner | — | 측정 중 | — | — | — | 24 |
| S046 | `/reports` | learner | — | 측정 중 | — | — | — | 17 |
| S048 | `/settings` | learner | — | 측정 중 | — | — | — | 20 |
| S049 | `/sitemap` | learner | — | 측정 중 | — | — | — | 15 |
| S051 | `/teacher` | learner | — | 측정 중 | — | — | — | 23 |

## 읽기(텍스트) — 5

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S052 | `/text` | learner | L0–L2 | 측정 중 | — | — | — | 46 |
| S053 | `/text/[id]` | learner | L0–L2 | 측정 중 | pending | 채색 지문 | — | 95 |
| S054 | `/text/[id]/comic` | learner | L0–L2 | 측정 중 | pending | — | — | 5 |
| S055 | `/text/new` | learner | L0–L2 | 측정 중 | — | — | — | 29 |
| S067 | `/text/[id]/echo` | session | L4c | 측정 중 | pending | — | — | 23 |

## 학습 모듈 — 18

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S024 | `/dictate` | learner | L6 | 측정 중 | — | — | — | 46 |
| S025 | `/dictate/results` | learner | L6 | 측정 중 | — | — | — | 23 |
| S026 | `/dictate/setup` | learner | L6 | 측정 중 | — | — | — | 26 |
| S027 | `/flashcard` | learner | L4a | 측정 중 | — | — | — | 14 |
| S041 | `/pairflip` | learner | L4a | 측정 중 | — | — | — | 25 |
| S042 | `/pairflip/results` | learner | L4a | 측정 중 | — | — | — | 10 |
| S047 | `/scriptquiz` | learner | L5 | 측정 중 | — | — | — | 21 |
| S050 | `/spellforge` | learner | L4b | 측정 중 | — | — | — | 16 |
| S056 | `/wordblitz` | learner | L4a | 측정 중 | — | — | — | 6 |
| S057 | `/wordvault` | learner | L3 | 측정 중 | — | — | — | 61 |
| S058 | `/wordvault/browse` | learner | L3 | 측정 중 | — | — | — | 25 |
| S059 | `/wordvault/review` | learner | L3 | 측정 중 | — | — | — | 20 |
| S060 | `/wordvault/study` | learner | L3 | 측정 중 | — | — | — | 22 |
| S062 | `/dictate/session` | session | L6 | 측정 중 | — | — | — | 30 |
| S063 | `/flashcard/play` | session | L4a | 측정 중 | — | — | — | 47 |
| S064 | `/pairflip/play` | session | L4a | 측정 중 | — | — | — | 31 |
| S065 | `/scriptquiz/play` | session | L5 | 측정 중 | — | — | — | 20 |
| S066 | `/spellforge/play` | session | L4b | 측정 중 | — | — | — | 48 |

## 라이브러리·만화·영상 — 15

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S015 | `/comics/adapted` | learner | — | 불필요 | — | — | — | 20 |
| S016 | `/comics/adapted/[bookId]` | learner | — | 불필요 | `/comics/adapted/66b084a0-72a1-414a-98ea-3c273087` | — | — | 22 |
| S017 | `/comics/restored` | learner | — | 불필요 | — | — | — | 20 |
| S018 | `/comics/restored/[slug]` | learner | — | FAIL | pending | — | — | 8 |
| S030 | `/library/books` | learner | — | 측정 중 | — | — | — | 43 |
| S031 | `/library/books/[bookId]` | learner | — | 측정 중 | pending | — | — | 37 |
| S032 | `/library/scripts` | learner | — | 측정 중 | — | — | — | 33 |
| S033 | `/library/scripts/[bookId]` | learner | — | 측정 중 | pending | — | — | 7 |
| S034 | `/library/textbooks` | learner | — | 측정 중 | — | — | — | 38 |
| S035 | `/library/textbooks/[series]` | learner | — | 측정 중 | pending | — | — | 38 |
| S036 | `/library/textbooks/[series]/[step]` | learner | — | 측정 중 | pending | — | — | 37 |
| S037 | `/library/textbooks/[series]/[step]/practice` | learner | — | 측정 중 | pending | — | — | 24 |
| S038 | `/library/vocab` | learner | — | 측정 중 | — | — | — | 48 |
| S039 | `/my/books` | learner | — | 측정 중 | — | — | — | 1 |
| S040 | `/my/texts` | learner | — | 측정 중 | — | — | — | 1 |

## CSAT — 3

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S019 | `/csat` | learner | — | 필요 | — | — | — | 32 |
| S020 | `/csat/formulas` | learner | — | 필요 | — | — | — | 19 |
| S061 | `/csat/dissect` | session | — | 필요 | — | — | — | 43 |

## 관리자 — 60

| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |
|---|---|---|---|---|---|---|---|---|
| S068 | `/admin` | admin | — | 측정 중 | — | — | loading/error/not-found | 28 |
| S069 | `/admin/analytics` | admin | — | 측정 중 | — | — | — | 23 |
| S070 | `/admin/articles` | admin | — | 측정 중 | — | — | — | 41 |
| S071 | `/admin/articles/preview/[id]` | admin | — | 측정 중 | pending | — | loading | 27 |
| S072 | `/admin/billing` | admin | — | 측정 중 | — | — | — | 21 |
| S073 | `/admin/comic` | admin | — | 측정 중 | — | — | — | 23 |
| S074 | `/admin/comic/[bookId]` | admin | — | 측정 중 | pending | — | — | 22 |
| S075 | `/admin/comic/[bookId]/drain` | admin | — | 측정 중 | pending | — | — | 20 |
| S076 | `/admin/compose` | admin | — | 측정 중 | — | — | — | 23 |
| S077 | `/admin/csat` | admin | — | 측정 중 | — | — | — | 36 |
| S078 | `/admin/csat/authoring` | admin | — | 측정 중 | — | — | — | 25 |
| S079 | `/admin/csat/blueprint` | admin | — | 측정 중 | — | — | — | 24 |
| S080 | `/admin/csat/catalog` | admin | — | 측정 중 | — | — | — | 25 |
| S081 | `/admin/csat/evidence` | admin | — | 측정 중 | — | — | — | 46 |
| S082 | `/admin/csat/new` | admin | — | 측정 중 | — | — | — | 25 |
| S083 | `/admin/csat/press` | admin | — | 측정 중 | — | — | — | 25 |
| S084 | `/admin/csat/review` | admin | — | 측정 중 | — | — | — | 25 |
| S085 | `/admin/csat/sources` | admin | — | 측정 중 | — | — | — | 29 |
| S086 | `/admin/csat/sourcing` | admin | — | 측정 중 | — | — | — | 24 |
| S087 | `/admin/csat/strategy` | admin | — | 측정 중 | — | — | — | 27 |
| S088 | `/admin/curation` | admin | — | 측정 중 | — | — | loading | 50 |
| S089 | `/admin/curation/preview/[bookId]` | admin | — | 측정 중 | pending | — | loading | 46 |
| S090 | `/admin/db` | admin | — | 측정 중 | — | — | — | 28 |
| S091 | `/admin/kice` | admin | — | 측정 중 | — | — | — | 27 |
| S092 | `/admin/kice/[typeId]` | admin | — | 측정 중 | pending | — | — | 34 |
| S093 | `/admin/kice/item/[slug]` | admin | — | 측정 중 | pending | — | — | 39 |
| S094 | `/admin/kice/map` | admin | — | 측정 중 | — | — | — | 23 |
| S095 | `/admin/kice/plan` | admin | — | 측정 중 | — | — | — | 32 |
| S096 | `/admin/kice/predict` | admin | — | 측정 중 | — | — | — | 24 |
| S097 | `/admin/library` | admin | — | 측정 중 | — | — | — | 21 |
| S098 | `/admin/pd-comics` | admin | — | 측정 중 | — | — | — | 26 |
| S099 | `/admin/pd-comics/reader/[issueId]` | admin | — | 측정 중 | pending | — | — | 20 |
| S100 | `/admin/pending-words` | admin | — | 측정 중 | — | — | — | 24 |
| S101 | `/admin/quality` | admin | — | 측정 중 | — | — | — | 20 |
| S102 | `/admin/quality/gates` | admin | — | 측정 중 | — | — | — | 23 |
| S103 | `/admin/quality/judge` | admin | — | 측정 중 | — | — | — | 20 |
| S104 | `/admin/reports` | admin | — | 측정 중 | — | — | — | 21 |
| S105 | `/admin/settings` | admin | — | 측정 중 | — | — | — | 21 |
| S106 | `/admin/topic-corpus` | admin | — | 측정 중 | — | — | — | 21 |
| S107 | `/admin/users` | admin | — | 측정 중 | — | — | — | 23 |
| S108 | `/admin/video` | admin | — | 측정 중 | — | — | — | 40 |
| S109 | `/admin/vocab` | admin | — | 측정 중 | — | — | — | 1 |
| S110 | `/admin/vocab/collections` | admin | — | 측정 중 | — | — | — | 21 |
| S111 | `/admin/vocab/curate/[run_id]` | admin | — | 측정 중 | pending | — | — | 27 |
| S112 | `/admin/vocab/runs` | admin | — | 측정 중 | — | — | — | 30 |
| S113 | `/admin/vocab/runs/[id]` | admin | — | 측정 중 | pending | — | — | 36 |
| S114 | `/admin/vocab/runs/[id]/seed` | admin | — | 측정 중 | pending | — | — | 23 |
| S115 | `/admin/vocab/runs/[id]/seed/preview` | admin | — | 측정 중 | pending | — | — | 28 |
| S116 | `/admin/vocab/runs/new` | admin | — | 측정 중 | — | — | — | 25 |
| S117 | `/admin/vocab/sources` | admin | — | 측정 중 | — | — | — | 22 |
| S118 | `/admin/vocab/sources/new` | admin | — | 측정 중 | — | — | — | 22 |
| S119 | `/admin/vocab/studio` | admin | — | 측정 중 | — | — | — | 42 |
| S120 | `/admin/vocabulary` | admin | — | 측정 중 | — | — | — | 24 |
| S121 | `/admin/vrl` | admin | — | 측정 중 | — | — | — | 43 |
| S122 | `/admin/vrl/automation` | admin | — | 측정 중 | — | — | — | 18 |
| S123 | `/admin/vrl/concerns` | admin | — | 측정 중 | — | — | — | 21 |
| S124 | `/admin/vrl/diagnostic` | admin | — | 측정 중 | — | — | — | 21 |
| S125 | `/admin/vrl/snapshots` | admin | — | 측정 중 | — | — | — | 22 |
| S126 | `/admin/vrl/taxonomy` | admin | — | 측정 중 | — | — | — | 23 |
| S127 | `/admin/vrl/users` | admin | — | 측정 중 | — | — | — | 22 |

## 제외

| ID | route | 이유 |
|---|---|---|
| S128 | `/comics` | redirect 전용 — 보여 주는 것이 없다 |
| S129 | `/library` | redirect 전용 — 보여 주는 것이 없다 |
| S130 | `/my` | redirect 전용 — 보여 주는 것이 없다 |
| S131 | `/my/books/[bookId]` | redirect 전용 — 보여 주는 것이 없다 |
| S132 | `/my/words` | redirect 전용 — 보여 주는 것이 없다 |
| S133 | `/arcade` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S134 | `/arcade/ranking` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S135 | `/play/cascade` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S136 | `/play/connections` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S137 | `/play/daily-blitz` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S138 | `/play/ghost-race` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S139 | `/play/glyph-tongue` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S140 | `/play/letter-forge` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S141 | `/play/lexicon-detective` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S142 | `/play/lexicon-estate` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S143 | `/play/lexicon-hands` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S144 | `/play/morpheme-rules` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S145 | `/play/morphmerge` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S146 | `/play/pirate-quest` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S147 | `/play/silent-rule` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S148 | `/play/word-customs` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S149 | `/play/word-economy` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S150 | `/play/word-orrery` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S151 | `/play/wordblitz` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S152 | `/play/wordfall-cadence` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S153 | `/play/wordsmith-vigil` | 아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2) |
| S154 | `/dev` | 개발 도구 — 학습자·관리자가 보지 않는다 |
| S155 | `/dev/components` | 개발 도구 — 학습자·관리자가 보지 않는다 |
| S156 | `/dev/directions` | 개발 도구 — 학습자·관리자가 보지 않는다 |
| S157 | `/dev/tts-probe` | 개발 도구 — 학습자·관리자가 보지 않는다 |
