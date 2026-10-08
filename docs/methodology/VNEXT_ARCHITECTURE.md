<!-- docs/methodology/VNEXT_ARCHITECTURE.md -->
# 영어 학습 원리 시스템 vNext — 통합 아키텍처 정본 (Phase 1)

작성 2026-10-08 · 상태 **설계 정본 — Phase 2 스키마 적용됨(20261008120000)**. 기존 정본 [SYSTEM.md](./SYSTEM.md)(5층 등록부)는 보존하고, 이 문서가 그 위의 확장 계약이다.
근거: 저장소 감사(코드 경로는 아래 각 절) · DB 직접 질의(2026-10-08) · [REVIEW_BRIEF_2026-10-08.md](./REVIEW_BRIEF_2026-10-08.md). 문서 수치와 DB 가 다르면 DB 가 맞다.

목표 순환: **탐구 질문 → 다중 출처 → 주장 추출 · 교차 분석 → 원리 정립 → 학습 방법 설계 → 학습자 적용 → 효과 검증 → 원리 재평가**.
성공 기준: 관리자 화면이 아니라 **근거 있는 원리가 학습 행동을 결정하고, 그 결과가 다시 원리를 평가하는 완결 경로**.

---

## 1. 현행 감사 — 사실(2026-10-08)

| 항목 | 실측 |
|---|---|
| `knowledge_items` | 153 — essence 4 · principle 13 · method 18 · practice 118. **adopted 0 · applied 0 · efficacy 전부 not_assessed** |
| `knowledge_evidence` | 118 — 전부 `external`(강사 영상) · A · stated 99 / observed 19. **L1–L3 근거 0** |
| `knowledge_links` | 150 — 전부 `implements`(옆 관계 0) |
| `knowledge_csat_origins` | 713 — A 102 · B 31 · C 1 · G 579 |
| `knowledge_gaps` · `knowledge_reviews` | 2 · 153(대부분 자동 전이) |
| `methodology_*` 원장 | batch 1 · sources 64 · experts 11 · channels 3 · taxonomy 59 |
| 학습자 코드에서 등록부 읽기 | **0**(admin · lib/knowledge · lib/methodology 밖 grep 0) |

코드: 라우트 `apps/web/src/app/admin/knowledge/**`(8) + `/admin/methodology` · 액션 `admin/knowledge/actions.ts`(상태 변경 · 항목/연결/근거 추가 — **수정 · 삭제 · 공백 · efficacy · 적용 경로 없음**) · 로더 `lib/knowledge/server.ts` · 규칙 `lib/knowledge/rules.ts` · 트리거 6개(근거 등급 동기화 · 재등급 재검토 · 근거 0 재검토 · 채택 근거 필수 · 근거 버전) · RPC `knowledge_import_claim`(외부 근거만) · 스크립트 `scripts/knowledge/*`(yt-import · claims-import · codex-extract-batch · concurrency-test(수동)).

## 2. 구조적 결함

1. **층이 서로 다른 것을 섞는다.** L2 「원리」 13개에 학습 · 기억 기제(인출 · 간격 반복 …)와 영어 처리 기제(순차 처리 · 응집 단서 · 음운 해독)가 함께 있다. L1 「본질」 4개는 영역 단위가 아니라 묶음이고, 그중 「기억 · 인출」은 본질이 아니라 학습 기제다.
2. **근거가 한 방향 · 한 출처뿐이다.** 근거 118 전부가 L4 · 강사 영상. 연구 근거 0, L1–L3 근거 0 → 규칙상 위층은 하나도 채택될 수 없다. A 등급은 「강사가 그렇게 말한 위치를 확인함」이지 효과가 아니다.
3. **근거의 세 축이 한 칸에 있다.** 출처 확인도(A/B/C/G) · 연구 설계 수준 · 학습자 적용 적합성이 구분되지 않는다(`efficacy` 한 칸뿐, 채울 경로 없음).
4. **탐구 질문이 없다.** 무엇을 알고 싶어서 모으는지가 객체로 없다 — 수집이 질문을 이끌지 못하고, 결론 후보 · 반례 · 불확실성을 둘 자리가 없다.
5. **제품과 단절.** `applied` 상태 · `product_modules` 칸은 있지만 쓰는 경로 · 기준 · 학습자 코드가 없다. 결과를 다시 원리로 돌려보낼 데이터 고리도 없다.
6. **검토 병목 · 채택 0.** 「사람만 채택」인데 사람 검토자가 없다(사용자 결정: 검수 = Claude Code · Codex). 다중 모델 판정 · 표본 감사 규칙이 없다.
7. **재검토 트리거 미구현.** 근거 추가 · 위층 문장 변경(version+1)이 아래층에 전파되지 않는다.
8. **운영 결함.** 분류 ID(text[]) FK 없음(최신 batch 로만 앱 검증) · 두 증거 모델(`methodology_evidence` 원장 vs `knowledge_evidence`) · 귀속 어휘 불일치(source_explicit/analyst_inference vs stated/observed/inferred) · 상세 화면이 링크 · 항목 전량을 읽음(`server.ts:396-400`) · 서버 액션 · 트리거 자동 테스트 없음 · 문서 표류(README 낡음 · 없는 `source-origin-review.mjs` 인용 · `observed` 누락).

## 3. 지식 모델 vNext — 6 객체 + 탐구 · 적용 · 검증

기존 4층(`layer`)은 **지우지 않고** 「종류(kind)」로 세분한다. 연결 규칙(`implements` 한 층 위)은 그대로 유지된다.

| # | 객체(kind) | 담는 것 | 층(layer, 기존) | 예 |
|---|---|---|---|---|
| 1 | `competency` 역량 목표 | 영어 영역별 「잘한다」의 정의 · 관찰 가능한 수행 | essence | 독해 — 주장과 근거 관계 이해 |
| 1′ | `essence_bundle`(기존 4개) | 영역을 가로지르는 묶음 서술 — **보존 · 읽기 전용 표지** | essence | 의미 처리 · 산출 … |
| 2 | `processing_mechanism` 언어 처리 기제 | 영어를 이해 · 산출할 때 머릿속에서 일어나는 처리 | principle | 순차 누적 처리 · 응집 단서 · 음운 해독 · 논증 구조 표상 |
| 3 | `learning_mechanism` 학습 · 기억 · 습득 기제 | 왜 그렇게 하면 배워지는가 | principle | 인출 연습 · 간격 반복 · 피드백 대조 · 자동화 |
| 4 | `method` 교수 · 학습 방법론 | 기제를 한 영역 · 조건에 적용하는 절차 | method | 근거 기록 후 해설 대조 |
| 5 | `task` 학습 실행 과제 | 학습자가 하는 구체 활동(조건 · 입력 · 정답 판정 · 소요) | practice | 주장 문장 → 근거 문장 고르기 |
| 6 | 근거 · 검증 결과 | 출처 근거(evidence) + 효과 검증(trial result) | (L5) | 메타분석 · 기출 관찰 · 시범 결과 |

영역(domain) = 기존 분류 skill 축(독해 · 논리적 읽기 · 어휘 · 문법 · 듣기 · 말하기 · 쓰기 · 발음 · 요약 · 배경지식) + 추가 후보 구문 · 상호작용 · 학습 전략(분류 batch 추가 — Phase 2). **근거가 부족한 역량 정의는 `in_review` 로 두고 확정하지 않는다.**

### 3-1. 근거 세 축(독립)
| 축 | 값 | 누가 정하나 |
|---|---|---|
| 출처 확인도 `grade`(기존) | A 위치 대조 · B 서지만 · C 계보 · G 공백 | 대조한 사람 · 모델 |
| 연구 근거 수준 `evidence_level`(신규) | meta_analysis · systematic_review · rct · quasi_experimental · correlational · descriptive · exam_observation · expert_opinion · practitioner_claim · not_rated | 출처의 연구 설계(서지에서) |
| 적용 적합성 `applicability`(신규) | high · partial · low · unknown(+ 대상 언어 · 학령 · 맥락 메모) | 대상 조건 대비 |
- 강사 주장 = `practitioner_claim`(가설). 전문가 다수 동의 · AI 합의는 수준을 올리지 않는다.
- `efficacy`(항목)는 **연구 근거(quasi_experimental 이상 · 적합성 partial 이상)** 또는 **자체 효과 검증 결과**가 있을 때만 not_assessed 밖으로 — DB 규칙으로 강제(Phase 2).

### 3-2. 새 객체
| 표(신규) | 담는 것 |
|---|---|
| `knowledge_research_sources` | 연구 서지(DOI · 인용 · 설계 · 표본 · L2 맥락 여부 · 연도) — 원문 저장 안 함 |
| `knowledge_inquiries` | 탐구 질문(질문 · 영역 · 상태 open/investigating/concluded/parked · 결론 항목) |
| `knowledge_inquiry_links` | 질문 ↔ 항목 · 근거(역할 claim · support · counter · uncertain · 충돌 메모) |
| `knowledge_applications` | 제품 적용(항목 → 학습자 표면 · 버전 · 상태 draft/active/paused/rolled_back · 대상 · 제외 조건 · 배포 시각) |
| `knowledge_trials` | 효과 검증 프로토콜(적용 → 사전 · 사후 · 지연 · 전이 설계 · 최소 표본 · 상태 · 결과 요약 · **synthetic 표시**) |
| `learning_task_attempts` | 학습자 과제 수행(사용자 · 과제 · 문항 · 단계 pre/practice/post/delayed/transfer · 응답 · 정오 · 시간 · 시각) — RLS 본인만 |
상태 규칙(DB 트리거 · Codex 계획 리뷰 반영 · 격리 검증 36/36):
- 적용 `active` ← 항목이 채택(adopted/applied) + 검증 프로토콜(trial) 있음. 항목 `applied` ← active 적용 있음(진입 때만 검사).
- 이탈: 마지막 active 적용이 빠지면 applied 항목은 재검토 · 항목이 재검토 · 반려로 가면 active 적용 자동 중단(학습자에게 내림) · active 적용의 마지막 trial 은 지울 수 없음.
- efficacy ← 그 값을 뒷받침하는 연구 근거(준실험 이상 · 적합 high/partial) 또는 같은 결과의 실제 학습자 trial(INSERT 포함). 합성 trial 은 못 바꾼다.
- 비합성 trial 의 분석 완료 ← 그 trial 에 묶인 실제 학습자 사전 · 사후 기록이 최소 표본 이상. 연구 서지 설계는 불변.
- `kind` 는 쓰기 경로가 갱신될 때까지 nullable(essence · principle 은 null = 미분류) — NOT NULL 은 Phase 2 코드 뒤 별도 마이그레이션.

### 3-3. 기존 → 새 매핑(삭제 없음)
| 기존 | vNext |
|---|---|
| essence 4(의미 처리 · 기억·인출 · 산출 · 소리-의미) | `essence_bundle` 표지(보존). 「기억·인출」은 본질이 아니라 학습 기제 묶음이라는 검토 메모를 단다. 영역별 `competency` 를 새로 쓴다(첫: 독해 주장-근거) |
| principle 학습과학 7 + feedback-comparison · output-automatization | `learning_mechanism` |
| principle sequential-processing · cohesion-cues · task-directed-attention · phonological-decoding | `processing_mechanism` |
| method 18 | `method`(그대로) |
| practice 118(강사 영상 주장) | `task`(조건 있는 실행 과제 후보) · 근거 `evidence_level = practitioner_claim` |
| evidence 118 | grade 유지 · `evidence_level` practitioner_claim · `applicability` unknown |
| csat_origins 713 | 기출 원천 등록부 유지 — 역량 근거로 쓸 때 `exam_observation` |
| methodology_* 원장 | 읽기 전용 원장(가져오기 기록) 유지 |

## 4. 연구 · 강사 · 기출 통합 파이프라인
```
탐구 질문 ─┬─ 강사 영상(기존 claims 파이프라인) ─────────── practitioner_claim
           ├─ SLA · 응용언어학 · 인지과학 연구(서지 · DOI) ── 설계별 evidence_level
           ├─ 공식 교육과정 · 교수 자료 ──────────────────── expert_opinion / descriptive
           ├─ 수능 · 모평 · 학평 기출(원천 · 문항 분석) ─────── exam_observation
           └─ 실제 학습 결과(learning_task_attempts · trial) ─ 자체 검증 결과
→ 질문별 주장 비교표(지지 · 반례 · 불확실) → 결론 후보(항목 in_review) → 채택 규칙 → 적용 → 검증 → 재평가
```
- 수집은 질문에서 시작한다(질문 없는 대량 수집 금지). 원문(자막 · 지문 · 논문 본문)은 저장하지 않는다 — 서지 · 위치 · 재서술만(기존 원칙).
- **AI 역할**: 출처 비교 · 중복 탐지 · 반례 탐색 · 초안. **채택 규칙**(사람 검토자 없음 — 사용자 결정): 독립 두 모델(Claude Code · Codex) 판정 + 미리 고정한 합성 규칙 + 갈린 칸만 블라인드 3차 판정(M2409 태깅에서 쓴 절차) · 결과 표지 `dual_model_adopted` 등 출처 보존. **AI 합의는 출처 확인 · 문장 품질만 결정하고 효과 수준을 정하지 않는다.**

## 5. 관리자 — 5개 업무 공간(기존 8 라우트는 보존해 탭으로 흡수)
| 공간 | 라우트(안) | 하는 일 | 흡수하는 기존 화면 |
|---|---|---|---|
| A 원리 운영실 | `/admin/knowledge` | 단계별 현황(질문 · 근거 · 채택 · 적용 · 검증) · 병목 · 공백 · 우선 처리 큐 — 숫자 클릭 = 해당 작업 화면 | (원리 지도 격자는 B 로) |
| B 영어 역량 · 원리 지도 | `/admin/knowledge/map` | 영역별 역량 지도 · 역량 ↔ 기제 ↔ 방법 ↔ 과제 관계 그래프 · 노드 상세 판(선행 역량 · 근거 · 연결 모듈) | 원리 지도 · 본질·원리 · 방법론·공부법 · 항목 상세 |
| C 탐구 · 근거 연구소 | `/admin/knowledge/lab` | 탐구 질문 · 주장 비교 · 연구 근거 대조 · 충돌 · 반례 · 불확실성 · 결론 후보 | 검토 대기 · 근거·출처 · 기출 원천 · 전문가·채널 · 공백 · 가져오기 원장 |
| D 학습 설계 · 검증 | `/admin/knowledge/design` | 원리 기반 과제 설계 · 학습 모듈 매핑 · 대상 · 제외 조건 · 사전 · 사후 · 지연 · 전이 평가 설계 | (신규) |
| E 제품 적용 · 품질 | `/admin/knowledge/product` | 적용 모듈 · 배포 버전 · 학습 결과 · 근거 변경 영향 · 재검토 · 중단 · 롤백 | (신규) |
- 기존 URL 은 그대로 열린다(링크 보존) — 사이드바만 5개로 재편. 화면도움말(`lib/admin/help/knowledge.ts`)은 화면 변경과 같은 커밋.
- 디자인: Admin 정본 = 3B 앱(`skins/admin-app.css`). 목록보다 **관계와 다음 행동**이 보이게 — 측정 절차(ref-measure · ref-compare)는 DESIGN.md 를 따른다.

## 6. 학습자 연결 계약
관리자 지식(층 · 등급 · 내부 코드)은 학습자에게 내지 않는다. 학습자에게는:
- 현재 확인된 역량 · 근거가 부족해 추가 확인이 필요한 역량(학습 지도 「기록 더 필요」 · 「직접 확인」 꼴)
- 추천 과제 하나 · 추천 이유(한 줄) · 구체 절차 · 결과와 다음 행동
- 자유 이동 보장(추천은 강제 경로가 아니다). 진단 데이터가 부족하면 원인을 정하지 않고 직접 확인 과제를 제안한다(학습 지도 axis-routing 계약과 같은 철학).
- 학습자가 보는 과제는 **`active` 적용(knowledge_applications)** 이 있는 것만.

## 7. 첫 수직 경로 — 독해 「주장과 근거 관계 이해」
| 단계 | 내용 | 실제 자리(감사로 확인) |
|---|---|---|
| 1 탐구 질문 | 「글에서 주장과 그것을 받치는 근거의 관계를 아는 능력은 어떻게 기르고 확인하는가」 | `knowledge_inquiries` |
| 2 근거 | 강사 영상 주장(기존 L4 중 독해 35 · 근거 기록 · 요지 종합 방법) + 연구(논증 구조 · text structure instruction 계열 서지 — 수집 대상) + 기출 관찰(주장 · 요지 · 목적 · 요약 · 빈칸 유형의 `answer_locus` 근거 문장) | evidence · research_sources · `csat_item_analyses.answer_locus`(`20260902055354…:77`) |
| 3 역량 | 「글의 중심 주장을 찾고, 그것을 받치는 근거 문장과 그 관계(예시 · 이유 · 대조 · 재진술)를 가려낸다」 | competency 항목(in_review) |
| 4 기제 | 처리: 논증 구조 표상 · 응집 단서(기존) / 학습: 인출 연습 · 피드백 대조(기존) | processing / learning_mechanism |
| 5 방법 | 「주장 → 근거 → 관계 표시 → 해설 대조」(기존 method-reasoned-review · method-gist-synthesis 연결) | method |
| 6 과제 | 주장 · 요지 · 목적 문항에서 ① 주장 문장 고르기 ② 근거 문장 고르기 ③ 관계 고르기 → 해설(answer_locus) 대조 | task + 문항별 주장-근거 주석(신규 · 드레인 · 검수) |
| 7 학습자 화면 | 문항 해설 극장 `/csat/item/[slug]`(AnalysisTheater) 안 「주장과 근거 찾기」 과제 — 학습 지도(feat/map-vnext) 근거 판단 · 문장 관계 단계의 확인하기 연결은 병합 결정 뒤 | `app/(main)/csat/item/[slug]/page.tsx` |
| 8 결과 기록 | `learning_task_attempts`(단계 · 응답 · 정오 · 시간) + 퍼널 이벤트(이벤트 목록 + DB 허용 목록 둘 다) | 신규 표 · `lib/analytics/events.ts` |
| 9 효과 검증 | 사전: 주장형 문항 정답률(`csat_session_attempts` · `csat_dx_response` A5/A3) → 과제 N회 → 사후 · 지연(14일 · `csat_review_queue`) · 전이(연습하지 않은 주장형 문항). 합성 학습자는 경로 검증만 — **효과 검증 완료로 보고하지 않는다** | `knowledge_trials` |
| 10 재평가 | trial 결과 → 역량 · 방법 항목 재검토(효과 지지 · 혼재 · 지지 안 됨) · 적용 유지/중단 | 상태 전이 · 재검토 트리거 |
주석 데이터: 지금 문항 분석에는 정답 근거 문장(`answer_locus.sentence_index`)만 있고 **주장 문장 · 관계 유형은 없다** → 문항별 주장-근거 주석 표(신규)를 LLM 드레인으로 채우고 두 모델 검수 후 쓴다.

## 8. 구현 · 검증 원칙
추가형 변경만(파괴 변경 · 데이터 초기화 없음) · 스키마 변경 전 체크포인트 · 승인된 SQL 해시 · 허용 표 · 범위를 목적 파일에 기록 · RLS(학습자 표 본인만 · 관리 표 service_role) · 동시성(상태 전이 「읽은 상태 그대로일 때만」 유지) · 브라우저 검증(관리 · 학습자) · 코드 · 테스트 · 문서 · 커밋 · push 를 작업 단위로.

### 8-1. 권한 모델(실측 2026-10-08 · 의도한 설계)

「RLS 없음」과 「RLS 켜짐 + 정책 없음」은 다르다 — 이 표들은 **후자 + 권한 회수**다(이중 거부).

| 표 | RLS | 정책 | anon / authenticated 표 권한 | 접근 경로 |
|---|---|---|---|---|
| `knowledge_items` · `knowledge_research_sources` · `knowledge_inquiries` · `knowledge_inquiry_links` · `knowledge_applications` · `knowledge_trials` | 켜짐(FORCE 아님) | 0 | 없음(SELECT 도 없음) | 관리자 Server Action(service_role)만 — 학습자 · 익명은 권한 단계에서 막히고, 권한을 실수로 GRANT 해도 정책 0 이라 행이 보이지 않는다 |
| `learning_task_attempts` | 켜짐 | 1(authenticated 본인 SELECT) | authenticated SELECT 만 · 쓰기 없음 | 읽기 = 본인 행 · 쓰기 = 서버(service_role) |

FORCE RLS 가 아닌 이유: 표 소유자(postgres)와 service_role 은 원래 RLS 를 우회한다 — 관리 쓰기 경로가 그것이라 FORCE 는 실익이 없다.
체크포인트 지표 `rls_missing_tables`(60→65)는 「정책 0 인 RLS 표」를 센 것이라 이 설계에서 의도된 증가다. 학습자 노출이 필요해지면 GRANT 가 아니라 **정책 + 최소 컬럼 GRANT** 를 같은 마이그레이션에서 더한다.

## 9. 단계 · 확인 지점
| Phase | 내용 | 승인 필요 |
|---|---|---|
| 1 | 이 문서 · 감사 · 계획 · Codex 계획 리뷰 · Phase 2 SQL 초안 | — |
| 2 | 추가형 스키마 `20261008120000_knowledge_vnext` **적용 완료(2026-10-08 · sha 5053c5ba…)** · kind/근거 수준 백필 · **5개 업무 공간 구현 완료**(운영실 · 지도 · 연구소 · 설계·검증 · 적용·품질 · 기존 8 URL 하위 탭) · 테스트 · 브라우저 21/21 | 승인됨 |
| 3 | 첫 수직 경로 — **독해 「주장과 근거 관계」 완료(2026-10-08)** · 2022 수능 20번 · 관리자 채택 사슬 · 문항 주석 · 학습자 과제 · 수행 기록 · 지도 FIND · 추적 · 재검토 전파 — [vertical/claim-support](./vertical/claim-support.md). 이벤트 허용 목록 마이그레이션은 하지 않음(수행 기록이 learning_task_attempts 에 남는다) | DB 가드 · 멱등 키 SQL 승인(미적용 후보) · 다음 경로 · 학습자 연습 기능 이식 |
| 4 | 검증 프로토콜 실행 · 재검토 트리거(근거 추가 · 위층 문장 변경) · 적용 중단 · 롤백 · 회귀 | 트리거 SQL 승인 |
