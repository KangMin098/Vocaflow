# 2015#25 콘텐츠 정정 — 사람 감수 자료

> 첫 실제 검수 사례. **사람 내용 승인: 없음.** DB · 강의 원본 · 탐구 데이터 · sidecar 를 바꾸지 않았다(제안만).
> 기계 판정 자료: [package.json](./package.json) — `scripts/csat/content-review/packages/2015-25.mts` 가 F 발행 전 검증 · 변경 영향 · **강의 적재 검사(validate.ts)** 를 실제로 돌려 만든다.
> 화면: `/admin/csat/content-review` 의 2015#25 후보 `cr_c1c10b90a202ff94` — 공식 원문 · 현재 분석·강의 · 수정 전후 낱말 차이(제안 8) · 발행 전 검증을 한 화면에서 본다.

## 1. 공식 근거

| 근거 | 내용 | 분류 |
|---|---|---|
| 평가원 정답표 원본 `2015영어영역_정답표_홀수.pdf` (sha256 `eec2f406…db467ce`) | 25번 정답 **「④, ⑤」** | 공식 사실 |
| [정책브리핑 교육부 정책뉴스 2014-11-24](https://www.korea.kr/news/policyNewsView.do?newsId=148787539) — 평가원 이의심사 결과 발표 | 「영어 25번 문항 역시 ④번과 함께 ⑤번도 정답으로 인정」 · 「'percent'는 백분율을 나타내고, 'percent point'는 백분율 간 차이를 나타내기 때문에 'percent'라고 표현한 답지 ⑤번은 주어진 그래프의 내용과 일치하지 않는다」 | 공식 사실(정답 집합 · ⑤ 인정 사유) |
| DB `csat_items` | `answer=4` · `answers=[4,5]` | 정답표와 일치(집합) |
| 같은 날 보도(아주경제 · 강원일보) | 위 발표 전재 | 보조 |

**확정하지 않는 것:** 원래 ④ 하나만 의도했다는 추정 — 공식 근거가 없어 출제 의도로 쓰지 않는다(분석 v6 의도 칸에 「확정하지 않음」으로 명시).

## 2. 실제 오류 (학습자에게 보이는 것)

| 위치 | 지금 | 판정 |
|---|---|---|
| 분석 v1~v5(모두 published · 학습자는 최신 published 하나) ⑤ | `distractor` — 「20−2=18 … 맞는 진술이라 답이 아니다」 | 공식 정답 ⑤ 소거 |
| 분석 v5 풀이 2단계 | 「increase 숫자는 뺄셈」 | 틀린 일반 규칙 |
| 분석 v5 의도 · 근거 설명 · 문장 번호 | ④ 만 · [5] | ⑤ 누락 |
| 강의 c1 | 「답이 아닌 네 선지는 도표와 맞는 진술」 | 단일 정답 전제 |
| 강의 c2 · c11 · c12 | 퍼센트 증가를 뺄셈으로 · 「증가는 빼서 확인한다, 이것이 규칙」 | 틀린 일반 규칙 |
| 강의 c4 | 「사 번이 정답」만 | ⑤ 누락 |
| 강의 c9 (eliminate · reject:5) | 「⑤ … 맞는 진술이고, 답이 아닙니다」 | 공식 정답 소거 |
| **강의 c10 (추가 감수)** | ④ 이메일 주소의 배수 과장 함정을 「휴대폰 번호가 열 배로 늘어, 세 배도 그럴듯해 보이죠」로 ⑤ 항목에 엮는다 | 서로 다른 항목을 잇는 근거 없는 추정 — ⑤가 정답이 된 뒤 학습자 혼동 |
| 탐구 v3 `inquiry-data.json` (review verified) | ⑤ 를 맞는 진술(distractor)로 · 원리 「증가 진술은 차이로」 | 공식 정답 소거 · 틀린 원리 |
| 화면 정답 표시 `ItemScreen.tsx:100` · `overlay-reveal.ts:135` · `theater.ts:218` | 단일 `answer`(④)만 「정답」 | ⑤ 누락 — K4-a |
| **학습자 해설 로더 `learner.ts:616` (새로 확인)** | `verdict==='correct'` **첫 하나**만 정답 해설, distractor 만 오답 목록 | v6 에서 ⑤ 가 correct 가 되면 ⑤ 는 **두 목록 모두에서 빠진다** — K4-a 에 추가 인계 |

정상 유지: 강의 c3 · c5(④ 53÷29≈1.8) · c6~c8(①②③ 소거), 분석 v5 ①~④ 판정·도표 값.

## 3. 수정안 — 전후

강의 v3 → v4 제안(바뀌는 cue 7 · c9 위치 이동). 전문 `package.json` → `lecture_after_preview`.

| cue | 지금 | 수정안 |
|---|---|---|
| c1 | …답이 아닌 네 선지는 도표와 맞는 진술입니다. | …선지마다 도표와 맞는지 하나씩 판정합니다. *(공개 경계 앞 — 정답 번호를 밝히지 않는다)* |
| c2 | …몇 포인트 증가는 뺄셈입니다. | 선지마다 비교 종류를 먼저 표시하세요. 최고는 크기 비교, 세 배는 나눗셈, 몇 퍼센트 증가는 비율, 몇 포인트는 뺄셈입니다. |
| c4 | 여기 다섯 번째 문장, 사 번이 정답입니다. … | …사 번이 정답입니다. 오 번도 정답이에요. 평가원이 두 선지를 함께 인정했어요. … |
| c9 | *(eliminate · reject:5 · 9번째)* …맞는 진술이고, 답이 아닙니다. | *(evidence · anchor:sentence:5 · c5 바로 뒤)* 여기 여섯 번째 문장을 보세요. 휴대폰 번호는 이에서 이십, 차이는 십팔 퍼센트포인트예요. 증가율로는 구백 퍼센트라, 십팔 퍼센트 증가는 도표와 맞지 않아요. 그래서 오 번도 정답입니다. |
| c10 | …휴대폰 번호가 열 배로 늘어, 세 배도 그럴듯해 보이죠. … | …이메일 주소도 이십구에서 오십삼으로 크게 늘어, 세 배쯤 되어 보이기 쉽죠. … *(④ 항목 안으로 좁힘 · 경계 뒤)* |
| c11 | increase / 증가, 여기서는 뺄셈이에요. | increase / 증가, 퍼센트 증가는 비율이에요. |
| c12 | 배수는 곱해서, 증가는 빼서 확인한다, 이것이 규칙입니다. | 배수는 나눠서, 퍼센트 증가는 원래 값에 대한 비율로, 퍼센트포인트는 빼서 확인합니다. |

**c9 대상 · 역할을 바꾸는 이유(필수):** v6 에서 ⑤ 는 distractor 가 아니므로 강의 대상 목록(`lectureTargets`)에서 `reject:5` 가 **사라진다** — 옛 c9 는 적재 검사에서 `target` 오류로 실패한다(실행 확인). `analysis:answer` 블록은 단일 정답 칩(④)·해설만 그려 ⑤ 설명과 어긋난다. 그래서 c9 가 말하는 「여섯 번째 문장」 자리(`anchor:sentence:5` = ⑤ 선지 문장)를 비추고, 소거(eliminate)는 원문 자리를 가리킬 수 없으므로 정답 근거(evidence)로 바꿔 근거 묶음(c4·c5) 뒤로 옮긴다. 화면의 복수정답 처리(K4-a)와 무관하게 강의 말과 하이라이트가 맞는다.

분석 v6(새 판본 · v1~v5 보존): ⑤ `verdict correct` + why_correct · trap · confirmed_at(정답표 + 공식 발표) · 의도에 ⑤ 와 근거 분류 · 근거 설명과 문장 번호 [5,6] · 풀이 2단계.

탐구 v3: ⑤ 를 distractors 에서 빼고, 원리를 「배수·퍼센트 증가는 비율, 퍼센트포인트는 차이」로.

## 4. 검증 결과(실행값)

| 검사 | 지금 | 수정 후 |
|---|---|---|
| F 발행 전 검증 BLOCK | 6 (분석 ⑤ 소거 · 분석 단일 정답 · c1 단일 정답 전제 · c1 의미 불명확 · c4 ⑤ 누락 · c9 ⑤ 소거) | **0** |
| 강의 적재 검사 `validate.ts` (v6 대상 목록 · 골격 6문장) | — | **ok · issue 0** (수정안 1차에서 role-target · focus · cue-long 3 · directive 를 잡아 고쳤다). 옛 c9 대상은 `target` 오류 |
| 변경 영향 | — | 강의 v4 필요 · 분석 v6 필요 · **공개 경계 sidecar 재생성 필요**(c1·c2 경계 앞 변경 — 정답 노출 없음 · c9 이동으로 뒤 cue 위치 이동) · c9 target·role 변경 |

## 5. 분석 v6 SQL — JSON 필드 보존(DB 미적용 · SELECT 로만 검증)

[sql/analysis-v6.draft.sql](./sql/analysis-v6.draft.sql) — 같은 식을 INSERT 없이 SELECT 로 돌린 결과:

| 칸 | v5 | v6 | 판정 |
|---|---|---|---|
| answer_locus 키 | quote · reasoning · sentence_index | 같음 | 보존 · **quote 는 문자열 그대로**(로더 `binding/adapter.ts:51` · `evidence.ts:60` 계약) |
| ⑤ choice_analysis 키 | n · verdict · how_to_reject | n · verdict · trap · why_correct · confirmed_at | how_to_reject 만 제거 — 「맞는 진술이라 답이 아니다」가 새 판정과 모순(원문은 v5 에 남는다) |
| ①~④ choice_analysis | — | **v5 와 동일** | 보존 |
| solve_procedure on_fail | — | 4단계 모두 동일 | 보존(2단계 step 문장만 교체) |
| 나머지 칸(측정 능력 · 시간 · 난이도 · 어휘 · units) | — | v5 에서 복사 | 보존 |

로더 동작: 학습자 로더(`learner.ts:593` 등)는 `status='published'` **최신 판본 하나**만 읽는다 → v6 를 `in_review` 로 넣으면 학습자에게 보이지 않는다. 공개는 사람 승인 뒤 v6 를 published 로 바꾸는 한 줄. 복구 = v6 를 rejected 로(v5 가 다시 최신 published).

## 6. 같은 정본 — 영향 계약

반영 단위는 **한 묶음**이다(하나만 바꾸면 화면끼리 어긋난다).

| 순서 | 대상 | 소유 | 전제 |
|---|---|---|---|
| 1 | 사람 내용 감수(3트랙) | 검수자 | 이 자료 |
| 2 | 분석 v6 `in_review` 삽입 | DB(사용자 승인) | 1 |
| 3 | 강의 v4(`lecture-data/2015.json`) | 강의 owner | 2 — c9 대상이 v6 대상 목록과 맞아야 적재 통과 |
| 4 | 문항 골격(`skeleton-data/2015.json`)에 ⑤ 정답 자리(sentence 5) 배치 | 골격 owner | 2 |
| 5 | 공개 경계 sidecar 재생성(`scripts/csat/lecture-disclosure-build.mjs`) | csat-lecture-disclosure | 3 |
| 6 | 탐구 v3(`inquiry-data.json`) | 탐구 owner | 1 |
| 7 | 화면·해설 로더 복수정답 — `learner.ts:616` · `ItemScreen.tsx:100` · `overlay-reveal.ts:135` · `theater.ts:218` | K4-a(csat-judgment-d) — 중복 구현하지 않음 | 2 |
| 8 | 분석 v6 published + 발행 승인 | 사용자 · 발행 권한자 | 3~7 이 같은 binding(item md5 · 분석 v6 md5 · 강의 v4 hash)일 때만 |

## 7. 승인 저장 — 기존 표 재사용

`csat_pipeline_approvals` 실측: 결정 `approved|rejected|withdrawn` · `stage` 9종(`review` · `press` 포함) · `subject_kind` 6종(`item` 포함) · `evidence jsonb` · `decided_by` 비어 있으면 거부 · 비승인 사유 10자 이상 · RLS 켜짐 · **정책 0개(서비스 역할로만 쓰기)** · 현재 1행(교재 press). 고유 제약이 없어 결정은 **덧붙이고 최신 한 줄을 읽는다**(`approvals.ts` 의 `loadApprovals` 와 같은 방식) — 비파괴 원장과 같은 성질이라 새 표가 필요 없다.

| 상태 | 저장 |
|---|---|
| AI 검토 결과 | DB 에 넣지 않는다 — 패키지 · 검증 기록 파일 |
| 사람 내용 승인(트랙별 · 판본별) | `stage='review'` · `subject_kind='item'` · `subject_id='2015#25:official_answer' \| ':explanation' \| ':lecture_cue'` · `evidence={binding_hash, candidate_id, package_sha, reviewer_role, evidence_refs[]}` |
| 되돌림 | 같은 subject 에 `decision='withdrawn'` 한 줄 덧붙임(지우지 않음) |
| 시스템 발행 승인 | `stage='press'` · 같은 subject — 세 트랙 최신 결정이 모두 approved 이고 binding_hash 가 같을 때만 |

최소 서버 경로(설계 — 미구현):

- `POST /api/admin/csat/content-review/decisions` — `requireAdminApi()` 필수. **개발 우회(DEV_ADMIN_BYPASS) 세션은 거부**(합성 관리자 id 로 사람 승인이 생기지 않게). `decided_by` = 실제 로그인 관리자 id.
- 본문 `{candidateId, track, decision, reason, evidence[]}` — 서버가 후보의 **현재** binding 을 다시 계산해 `binding_hash` 와 다르면 409. F 의 `transition()` 계약(역할 · 판본에 묶인 필수 증거 · AI 승인 불가)을 서버에서 그대로 적용.
- 화면의 시연 원장은 이 경로를 부르지 않는다. 시연 원장 상태를 이 표로 옮기지 않는다.
- 이 경로를 만들고 첫 행을 쓰는 것은 별도 작업 · 사람의 실제 승인 뒤. **지금 approved 행 0.**
