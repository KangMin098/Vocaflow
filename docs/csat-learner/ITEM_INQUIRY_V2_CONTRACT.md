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
