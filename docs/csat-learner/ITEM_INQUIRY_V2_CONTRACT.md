# 문항 출제 사고 탐구 v2 — 계약 (vNext2)

> 정본 지시문: `D:\workspace\vocaflow-csat-vnext2-claude-instructions.md`(repo 밖). 이 문서는 저장소에 구현된 **실제 계약**만 적는다.
> 최초 작성 2026-10-11.

## 1. 목적

`/csat/item/[slug]` 에서 학습자가 기출분석 데이터로 **출제 설계 관계**(본질 · 지문 구조 · 정답 변환 · 오답 제조 · 원리의 적용 경계 · 기출 비교)를
근거 기반으로 탐구한다. 정답률 · 속도 · 점수를 이 화면의 목표로 삼지 않는다. 실제 출제자의 내부 사고를 확인했다고 말하지 않는다.

## 2. 여섯 장면 (구현됨 → 2026-10-12 v3 일곱 장면으로 개정: task · meaning · judgment · design · compare · principle · explain. 옛 값은 별칭 — 정본 `lib/csat/inquiry/scenes.ts`, 설계 docs/csat-learner/v3/)

| 장면 | `?scene=` | 보이는 것(데이터 출처) |
|---|---|---|
| 본질 | `essence` | 학습 목표 관계(teaching-contract) · 이 지문을 고른 이유(`passage_design.selection`) · 재는 능력 블록 |
| 지문 구조 | `structure` | 문장 역할 사슬 · 패턴 · 허용 대안 · 단서(`passage_design`) · 왼쪽 지문 지도 · 어휘 블록 |
| 발문·정답 설계 | `answer` | 원문 → 정답 변환(`passage_design.transform`) · 출제 의도 · 정답 근거 블록 · 근거 문장 확인 |
| 오답 설계 | `distractor` | 선지별 유지 / 바뀜 / 변환 / 내용 참거짓(**inquiry 데이터**) · 오답 블록 · 자기 설명 · 바뀐 성분 확인 |
| 공통 원리 | `principle` | 조건부 원리 · 통하는 조건 · 적용하면 안 되는 조건(**inquiry 데이터**) · 원리 저장 · 절차 블록 |
| 기출 비교 | `compare` | 독립 검수된 비교 쌍(`compare-data.json`). 없으면 「준비 중」 — 같은 유형으로 채우지 않는다 |

- 배정 정본 `apps/web/src/lib/csat/inquiry/scenes.ts` — 블록 하나는 한 장면에만. 모르는 장면 값은 `essence`.
- 자유 이동 · 잠금 없음(F01). 학습자가 고른 이동은 history 에 쌓고, 재생 중 강의가 다른 장면 블록을 가리키면 그 장면으로 따라가되 history 는 쌓지 않는다.
- 근거 수준 라벨: 설계 주석 · 탐구 데이터 = 「설계 가설 · 검수된 주석」, 원리 = 「일반화한 원리 · 이 문항 범위」.

## 3. 탐구 데이터 (inquiry v1)

**저장 결정(ADR, 2026-10-11):** DB `answer_locus` 에 키를 더하거나 분석 새 버전을 만들지 않는다. **분석 버전에 묶인 정적 정본**
`apps/web/src/lib/csat/inquiry-data.json` 으로 둔다(선례: `compare-data.json` · skeleton-data).

- 이유: DB 분석 정본 · 학평 독립 검수 · 버전 선택 규칙을 건드리지 않는다. 분석이 새 버전이 되면 조회가 `stale` 을 돌려 화면에서 빠진다.
  복구는 git revert. 마이그레이션 · 승인 대상 DB 쓰기가 없다.
- 한계: 다기기 개인 기록이 아니라 공용 콘텐츠다(개인 기록은 기존 `/api/csat/state`). 학평은 아직 대상 아님(2026-10-11 사용자 결정).

| 필드 | 값 |
|---|---|
| `analysis_version` | 만든 근거가 된 발행 분석 버전 — 화면은 같은 버전일 때만 쓴다(`lookupInquiry`) |
| `distractors[]` | 정답이 아닌 선지 전부. `n` · `truth`(false · true · not_applicable · unknown) · `operation`(16종) · `preserved[]{component,text}` · `altered[]{component,from,to}` · `note` |
| `principle` | `statement` · `when_applies[1..3]` · `when_not[1..3]` |

- `truth=true` — 부정형 선택 유형(어법 정상 형태 · 내용 일치 등, `distractorsAreTrue`)의 맞는 선지. 왜곡을 지어내지 않는다(altered 없음 · operation none).
- `truth=not_applicable` — 선지가 위치 · 지시 대상인 유형(R-IRRELEVANT · R-INSERT · R-ORDER · X-ORDER · R-REFER · X-REFER).
- 성분 12종 · 변환 16종 정의: `scripts/csat/inquiry-drain/WRITER.md`.

## 4. 공정 (재실행 안전)

1. `inquiry-drain-export.mjs` — 평가원 in_scope 최신 분석 → 청크(원문 포함 · **gitignore**). 같은 버전으로 채운 문항은 건너뜀.
2. 작성 에이전트 → `chunk-inq-NN.out.json`(한국어 결과 · 커밋).
3. `inquiry-drain-validate.mjs` — 형식 + 내용 대조(정답 번호 배제 · 선지 전부 · 유형별 truth · 영어 인용이 원문/선지에 실재 · 8단어 · 보편 법칙/출제자 내부 사고 단정 금지 · 원리 조건부).
4. 독립 검수(`REVIEWER.md`) — 다른 에이전트가 원문 대조로 pass/revise. revise 는 빌드에서 뺀다.
5. `inquiry-drain-build.mjs` — status ok · 검증 0 · **공개 가드**(`lib-inquiry-review.mjs`, 2026-10-12 v3 M2)를 지난 것만 `inquiry-data.json` 으로. 뺀 수와 이유를 출력.
   - verified = 현재 내용 해시(`inquiry-drain-hash.mjs`)에 묶인 명시 pass · 검수자 ≠ 작성 run · 기준 버전 `CRITERIA_VERSION` 일치. 같은 내용에 revise 가 있으면 revise. 파일 이름 순서는 무관.
   - legacy = 해시 결속 없는 v1 판정(2026-10-11 이전 786문항) — 보존 공개하되 화면에 「1차 검수(v1)」로 표시하고 verified 로 승격하지 않는다. `--verified-only` 는 legacy 도 뺀다.
   - 실패→성공 회귀: `node --test scripts/csat/__tests__/inquiry-review-guard.test.mjs`

## 5. 하지 않는 것

새 이벤트(DB CHECK 마이그레이션 필요 — 기존 `screen_viewed` · `csat_evidence_opened` · 강의 이벤트로 유지) · 원리 메모 새 저장소 ·
문제 생성 · 모바일 화면 · 학평(보류) · 원문 전체 공개.

## 6. 1차 생산 결과와 예외 (2026-10-11 · 평가원 802)

- 작성 33청크 · 검증기 오류 0 · 독립 검수 786문항 중 1차 pass 756(96.2%) → revise 30건 고쳐 쓴 뒤 재검수(`review-zz-fix.json`).
- **화면에서 뺀 문항 — needs_review 16**: 기존 분석(DB)의 문장 번호가 화면 문장 분할과 어긋나거나 인용이 틀렸다(판정 자체는 원문과 맞음).
  분석 교정 공정(새 분석 버전 · 독립 검수)의 몫이며, 고치면 export 가 새 버전으로 다시 뽑는다.
  `2014A#24 · 2014B#23 · 2014B#36 · 2015#34 · 2015#44 · 2016#44 · 2023#18 · 2023#19 · 2023#38(선지 원문 없음) · 2024#19 · 2026#19 · M1809#19 · M2006#19 · M2306#30 · M2309#19 · M2606#19`
- **원문 결함(분석은 정상)**: M2406#38 · #39, M2306#38 · #39 의 발문에 40번 요약문 조각이 섞여 있다(csat_items.stem). 원문 교정 공정 대상.
- 도표 문항 일부(M2206#25 · M2309#25 · M2406#25)는 입력에 수치가 없어 오답 truth 를 `unknown` 으로 둔다 — 원본 도표 검수가 끝난 문항만 `true`.
- 공정 개선(파일럿 · 검수에서 나온 것): ① 위치 · 지칭 유형은 `not_applicable` ② 낱말 묶음 선지에서 모든 칸이 틀리면 `preserved: []` 허용 ③ 검증기 따옴표 정규화(‘ ’ “ ”) ④ 도표 원리의 when_not 에 「원본 확인 필요」 같은 데이터 사정을 쓰지 않는다(R5).

## 7. v3 의미 · 판단 · 설계 칸 (2026-10-12 · v3 M2 대표 수직 구현)

- 설계 정본 `docs/csat-learner/v3/`(PR #223). 작성 지침 `scripts/csat/inquiry-drain/WRITER_V3.md` · 검수 R7~R9 `REVIEWER.md`.
- 기록마다 선택 칸 `v3`: requirement(요구 판단 · 극성 · 조건) · meanings(근거 문장 · 영어 표현 8단어 이하 · 문맥 의미 · 부정/조건 등 범위) ·
  choices(1~5 전부 — 정답 선정 · 내용 참거짓 · 발문 충족 분리 + 결정 조건 + 근거 문장) · design(공식 / 원문 관찰 / 설계 가설 + 한계) ·
  `units_hash`(문장 분할 결속) · `sentence_count`.
- **v3 칸은 verified(현재 내용 해시에 묶인 독립 pass)일 때만** 빌드에 실린다 — legacy 경로로는 절대 공개하지 않는다. 지도 문장 수가 작성 때와 다르면 근거 연결을 끈다.
- 공정: `inquiry-v3-export.mjs --name v3-NN --ids …`(v1 청크 입력 재사용) → 작성 → `inquiry-drain-validate.mjs --v3` → 해시 결속 독립 검수 → `inquiry-drain-build.mjs`.
- 1차(대표 6): 2026#34 · 2026#36 · 2026#38 · 2026#29 · 2026#25 · M2706#36 — 1차 검수 5 pass · M2706#36 revise(선지 1 설명이 배열과 모순 — 기존 DB 분석 choice_analysis n=1 의 같은 오류를 옮긴 것) → 고쳐 쓴 뒤 재검수 pass. **DB 분석 n=1 오류는 분석 교정 공정 대상으로 남아 있다.**
- 강의 schema3: `lecture/types.ts` `LectureV3`(장면 · 역할 · 주대상 · 관련 근거 · 결속) · `validateLecture` 가 schemaVersion 으로 분기(없음=legacy 규칙 그대로 · 3=장면 순서 · 장면별 역할 · 주대상 · 평가 과제/의미/성립 필수 · 그 밖=거부). 낭독 · 인용 · 길이 검사는 두 분기가 같은 함수. **schema3 강의 콘텐츠는 아직 없다.**
- 2차(26유형 대표, 2026-10-12): 남은 21유형 각 1문항(v3-02~04) — 1차 검수 18/21 pass, revise 3(2026#21 · 2026#22 v1/v3 내용 판정 모순, 2014B#37 v1 변환 라벨) →
  **계약 결함 수정**: v3 문항은 v1 에도 「내용 참 · 요구 미충족」을 허용하고, v1 · v3 내용 판정이 다르면 검증기 오류(같은 결함이 이미 verified 였던 2026#34 · 2026#23 에서도 드러나 함께 고침) → 고친 5문항 재검수 pass.
  결과: **평가원 26유형 전부 v3 대표 ≥1 · verified 27**(legacy 759). 회귀 `scripts/csat/__tests__/inquiry-validate-v3.test.mjs`.
- 3차(전량 확장, 2026-10-12): 남은 759문항을 v3-05~42 로 작성 → 2묶음씩 해시 결속 독립 검수.
  1차분(v3-05~24, 400) pass 395 · revise 5 → 고친 뒤 재검수 pass. 2차분(v3-25~42, 359) pass 316 · revise 43 → 고침 → 재검수 3회.
  **계약 · 공정 결함 수정**: ① 심경(R-MOOD)을 낱말 묶음 예외(preserved [])에 추가 ② 8단어로 줄이다 not · only 같은 판정 낱말이 인용 밖으로 빠지는 결함 —
  부정 범위는 검증기가 강제(인용에 부정어, 또는 note 가 그 문장의 부정어를 짚음; 전량 323건 중 6건 적발 · 수정), WRITER_V3 규칙 추가,
  REVIEWER **R7-경계** 정의(검수자마다 엄격도가 달라 수정이 반복됨 → revise 3종 · 메모 처리 경계 고정).
  결과는 빌드 요약을 정본으로 본다(`inquiry-drain-build.mjs --dry`). 회귀 `inquiry-validate-v3.test.mjs` 8개.
- 열린 과제: 연결 관계 반전 전용 변환 라벨이 없어 2014B#37 은 `polarity` 를 넓혀 썼다(정의표 확장 검토). 학평은 보류(공개 정책).

## 8. v3 M4 — 비교 쌍 · 조건부 원리 · 원리 노트 · 지도 복귀 (2026-10-12)

### M4 보고 대조에서 발견한 유형 metadata 결손 (2026-10-12)

- PR #230의 공개 JSON을 직접 계수한 결과749쌍 양쪽 유형1498칸이 모두 null이었다. `compare-v3-build.mjs`의 입력 파일명 정규식이 숫자 청크를 읽지 못했고, 화면의 `partnerTypes`가 빈 집합이 되어 비교/쌍 원리가 빠졌다. 가짜 두 문항 fixture의 projection 회귀만으로는 실제 산출물 결손을 잡지 못했다.
- 복구는 비교 본문/독립 검수/해시를 다시 생성하는 작업이 아니다. 공개 상대 목록과 동일한 `skeleton-data/<exam>.json`의 id/type_id를 사용해 유형 metadata만 재빌드한다. 원문 입력 파일이 없는 깨끗한 checkout에서도 동작한다. 입력이 있으면 정확한 파일명 규칙으로 읽고 골격과 유형이 충돌하면 중단한다. 공개 쌍 어느 한쪽의 유형이 없으면 null 적재/조용한 skip 대신 파일 쓰기 전에 build를 중단한다.
- 실제 정본 회귀: `scripts/csat/__tests__/compare-v3-types.test.mjs`는 모든 쌍의 유형을 공개 골격과 대조한다. `lib/csat/inquiry/__tests__/compare-v3.test.ts`는 정본의 모든477문항에서 상대 유형 조회→양방향 projection을 검사한다. 수정 전 실제 정본 테스트 실패, 수정 후 통과. 인위적으로 공개 목록을 허용한 기계 검사이며 실제 RLS/브라우저 확인을 대신하지 않는다.
- 재빌드 결과749쌍/110개 bounded 원리는 유지했고 유형 외 모든 pair 본문·binding과 item 색인은 기존 main과 deep equality로 확인했다. 같은 입력의 재빌드 byte diff0. 현재 데이터에는 다른 유형 사이의 쌍이0개이며 교차 유형 기능의 fixture 검증과 실제 사례 검증은 구별한다.
- M5 후속: 현재 화면 스펙은1280 라이트/1440 다크 두 조합뿐이므로1280·1440 각각 라이트/다크 네 조합으로 확대한다. 실제 장면/비교·원리 패널 존재, 노트 저장 실패/재개, 권한/원문/데이터 부재, 상대 분석/탐구 갱신 후 stale를 단언한다. URL/overflow/오류 문구/첫 화면 캡처만으로 학습 UX 완료를 판정하지 않는다. 원문을 보여 주는 실제 양쪽 비교와 문항당 최대70쌍의 선택/접기 사용성도 직접 검수한다. 이번 metadata 복구에서 강의·메뉴·학평 보류는 유지한다.
- 복구 검증: 관련 Node7개/웹 projection·노트10개 skip0 PASS, tsc/noEmit·변경 파일 eslint·Node syntax·agent 설정15/15·diff check PASS. 전체 스크립트는 병렬 실행의 VirtualAlloc 실패 후 순차 재검증278 PASS/0 FAIL/3 SKIP(기존 chart PostgreSQL·원문 corpus·live blind protocol 전제 없음). 스킵은 통과에 포함하지 않는다. 실제 화면/RLS/교육 효과는 여전히 미검증이다.

- **비교 쌍 v3** — 기존 `compare-data.json`(831선언 · legacy_unbound)은 그대로 두고 v3 로 승격하지 않는다. 화면에는 「검수 전 1차 비교」로 표시.
  공정: `compare-v3-export.mjs`(양쪽 공개 v3 쌍만 · 원문 포함 입력은 gitignore) → 작성(`compare-drain/WRITER_PAIR.md`) → `compare-v3-validate.mjs`
  → 해시 결속 독립 검수(`REVIEWER_PAIR.md`, 기준 `pair-v1.0`) → `compare-v3-build.mjs` → `compare-v3-data.json`.
  - 쌍 해시(`pairContentHash`)는 양쪽 결속(units_hash · 탐구 contentHash)을 포함한다 — 한쪽 탐구가 바뀌면 옛 pass 는 자동 무효, 빌드가 stale 로 뺀다.
  - kind: same_structure(같은 규칙 · 같은 판정) · contrast(같은 단서로 판정이 실제로 갈림) · boundary(한쪽은 문장 안, 다른 쪽은 다른 문장이 필요). 원리는 bounded 만(generalized 금지).
  - 공개 문장에 작성 과정(입력 · 기존 메모) 언급 금지 — 검증기가 강제.
- **서버 projection** `lib/csat/inquiry/compare-v3.ts` — 이 문항 탐구가 stale 이면 비교 전체를 숨기고, 상대는 상대 유형의 공개 목록(`revealedSkeletonSiblings`)으로 확인한다(교차 유형 허용). absence reason: none · partner_hidden · stale.
- **원리 수준** — 이 문항 원리 = candidate, 검수된 쌍의 원리 = bounded. 비교 클릭과 무관하게 「조건부 원리」 장면에 보인다. 원리 저장은 탐구 원리의 통하는 조건 · 쓰면 안 되는 조건을 담는다.
- **원리 노트** — `DissectionRecord.reasoningNotes`(v1 optional, 새 DB 컬럼 없음). 칸당 300자 · 100건(한글 최대치로도 약 360KB) · id 단위 병합(updatedAt) · 보류 문항 노트 비노출 · `afterExplanation: true` 고정 · 자동 채점 없음 · 이벤트에 글 · 문항 id 없음. 「내 설명」 장면에서 쓰고 검수된 원리와 스스로 대조.
- **지도 복귀** — 지도의 확인 링크(`?check=1`)로 들어오면 해설 보기 링크가 `from=map` 을 달고, 해설 화면 상단에 「학습 지도로」(`/csat/diagnosis`)가 보인다. 탐구 · 노트 이력은 독립 진단이 아니다(확인 · 전이 판정은 기존 승인 경로 그대로).
- 회귀: `scripts/csat/__tests__/compare-v3-guard.test.mjs` · `lib/csat/inquiry/__tests__/compare-v3.test.ts` · `lib/csat/__tests__/reasoning-notes.test.ts`.
- **1회차 결과(2026-10-12)** — 작성 797쌍(legacy 815 중 양쪽 공개 v3 아닌 18 제외) · 1차 독립 검수 → revise 수정 → 최종 재검수. 수치 정본은 `compare-v3-build.mjs --dry`.
  - kind 판정이 검수자마다 흔들려(「근거 종류가 다르다」를 contrast 로) 정의를 REVIEWER_PAIR 에 고정 · 작성 규칙 7~10 추가(v3 근거 대조 · contrast 는 판정이 갈릴 때만 · 내부 참조 금지 · 다른 선지 조합 확인).
  - **반복 차단 결정**: not_applicable(비공개)로 둔 쌍을 최종 재검수가 「다른 선지 조합이면 대응 성립」으로 뒤집은 12쌍은 이번 회차에 고치지 않는다(이전 검수는 not_applicable 을 요구 — 판정이 오가는 반복). 학습자에게 틀린 설명이 나가지 않는 보수적 결과다. 다음 회차 후보:
    2024#22~M2706#22 · M1809#22~M2706#23 · M1809#31~M2706#32 · M2006#21~M2706#21 · M2006#31~M2706#31 · M2109#41~M2706#41 · M2306#21~M2609#21 · 2014A#33~M2706#31 · 2014A#40~M2609#19 · 2014B#24~M2706#23 · 2014B#43~M2706#43 · 2016#19~M2706#19 (조합 제안은 `review-v3p-final-a/b.json`).

## 9. v3 M5 보강 — 비교 공개 경로 · 비교 탐구 · 노트 저장 결과 (2026-10-12)

- **유형 정본**: 상대 유형은 커밋된 공개 골격(`skeleton-data`)에서 읽는다(PR #231 cherry-pick — gitignore 입력이 없는 checkout 에서도 재빌드). 누락 · 충돌이면 빌드 실패(`lib-compare-types.mjs`).
- **상대 상태 쌍마다 구별**(`projectV3Pairs` · `PartnerState`): 공개 · 보류/접근 제한(골격엔 있으나 공개 목록 밖) · 골격에 없음(삭제 · 미발행) · 분석 바뀜(상대의 지금 공개 `units_hash` ≠ 쌍 결속). 뺀 쌍은 이유별 수를 화면에 밝힌다(`withheld`). 남은 쌍이 없으면 absence: none · partner_hidden · partner_missing · partner_changed · stale.
- **비교 탐구 화면**(`V3CompareExplorer`): 종류 필터 → 목록(listbox, ↑/↓ · Enter · Esc)에서 한 쌍 선택(주소 `?pair=`) → 대응 표(이 문항 근거 강조/해제 ↔ 관계 ↔ 상대 문장 · 선지 번호) · 공통/가르는 조건 · 한계. 상대 원문은 복제하지 않고 「상대 문항에서 이 비교 보기」(`?scene=compare&pair=&back=` · 지도 맥락이면 `from=map`) → `back` 으로 복귀. legacy 「검수 전 1차 비교」와 분리 표시.
- **원리 노트 저장 결과**: 저장은 실제 기기 저장 결과(`updateDissectionRecord().saved`)를 돌려주고, 실패면 입력을 비우지 않고 같은 id 로 「다시 저장」, 상태를 `role=status` 로 알린다. 서버 동기화는 기존 경로(기기 우선) 그대로.
- **실제 공개 자료 현황**: 749쌍 · 477문항 · bounded 원리 110 · **교차 유형 공개 쌍 0**(교차 유형 조회는 기능 · 픽스처로만 검증) · 한 문항 최대 70쌍.
- 회귀: `compare-v3.test.ts`(실제 정본 결속 · 상대 상태) · `V3CompareExplorer.test.tsx` · E2E `csat-v3-m5-explore`(로컬 — CI e2e 잡은 smoke 5종만 실행).
- **M5 범위 결정(2026-10-12 사용자)**: `/csat` **다크 테마 구현 · 검증은 범위 제외**(3B 스킨에 다크 규칙 없음). 실화면 검수는 PC 1280 · 1440 **라이트**만. 다크 제외는 다른 미완료 항목의 완료 근거가 아니다.
- **M5 보강 2(2026-10-12)**: 비교 쌍을 바꾸거나 해제 · 장면을 떠나면 그 비교가 켠 지도 근거 강조를 끈다 · 장면 복귀 시 주소 `?pair=` 로 같은 쌍 재선택 · 공개 쌍 결속에 양쪽 `analysis_version` 추가 → 화면이 양쪽(이 문항 · 상대) 문장 분할 · 분석 버전을 지금 공개 탐구와 대조(`inquiryBinding`) · CI 에 공개 정본 가드 4종(`compare-v3-binding` · `-types` · `-guard` · `inquiry-review-guard`) 편입 · 비교 목록 라벨 대비 수정(axe color-contrast).
