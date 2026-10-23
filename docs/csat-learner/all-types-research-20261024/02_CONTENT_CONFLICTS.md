# 02_CONTENT_CONFLICTS — D0-B 해설·강의·의미지원 내용 유사/충돌 (2026-10-24, 읽기 전용 조사)

범위: 2026-22·34·38. 출처
- 분석 v3/v5: `D:/workspace/Vocaflow-csat-v4-s0/apps/web/src/lib/csat/inquiry-data.json` (워크트리 HEAD `9e73d7660`, 세 문항 모두 `analysis_version:5, review:"verified"`)
- 강의 cue: `.../skeleton-v4/s1-v6/LECTURE_CUES.json` (원본 `apps/web/src/lib/csat/lecture-data/2026.json`@`3f437e9b6`, `contentValidation:"NOT_VERIFIED"`). "원본 37 cue" = 34(12)+22(13)+38(12)=37개 cue 총수다(LECTURE_CONTRACT.md:3). 단일 '37번 문항'이 아니다.
- C1: `.../s1-v6/correction/C1_CANDIDATE.json`(PROPOSED_NOT_APPROVED), `CORRECTION.md`
- 원문: SQL `select i.no,i.answer,i.passage,i.choices from csat_items i join csat_exams e … where i.no in (22,34,38) and e.id::text like '%2026%'` (정답 22=1, 34=3, 38=5 확인)
- 의미지원: `apps/web/src/lib/csat/meaning-support/data.ts:59-96` (같은 워크트리)

판정 축: W=문구 유사, F=판단 기능 유사, S=실제 의미 동일. 출제 의도 가설은 사실로 쓰지 않는다.

## SIMILARITY_MATRIX

| # | 문항 | 분석(v3) | 강의 cue | 관계 | W/F/S | 근거 |
|---|---|---|---|---|---|---|
| 1 | 38 ⑤ | choices[n=5].decisive "these…가 6~7번 문장에서 만들어진 서사를 받고" | c5 "일곱 번째 문장까지…부정적 서사…이런 서사가 바로 그것을 받아요" | SEMANTIC_SIMILAR(같은 좁은 범위를 공유) | 중/고/고 | inquiry-data 2026#38, LECTURE_CUES c5 |
| 2 | 38 ⑤ | 원본 decisive (sentences [1,6,7,8]) | C1 후보 (sentences [1,4,5,6,7,8], m3·m4 추가) | VERSION_DRIFT(미승인 후보) | 저/중/저 | C1_CANDIDATE.json |
| 3 | 38 원리 | principle "새 축을 여는 문장은 두 번째 예시 바로 앞" | c1 "두 번째 예시가 받칠 진술이 빈 자리가 답", c12 "짝이 없는 예시 바로 앞이 자리" | SEMANTIC_SIMILAR — 강의가 when_not 한정을 버려 과잉 일반화 | 중/고/중 | principle.when_not vs c12 |
| 4 | 38 ①~④ | distractors/choices decisive | c6~c9 | SEMANTIC_SIMILAR (②는 강의가 "8번 정체성 예시와 멀어진다" 근거 추가) | 중/고/고 | c7 |
| 5 | 34 ③ | decisive: 6·7번 + If 조건 + Ideally(m3 scope) | c4 "정답은 삼 번…법이 막는 건 어차피 고르지 않을 행동" | PARTIAL_OVERLAP — Ideally/If 한정 생략 | 중/고/중 | m2·m3 scope vs c4; 제안문은 cueContract c1 proposal |
| 6 | 34 ② | content_truth:"unknown", "법이 옹호자인지는 지문이 다루지 않아 참·거짓을 정할 근거가 없다" | c7 "강한 방어자는 칸트이고, 법은 방어받는 쪽입니다", c10 "주체 역전" | CONTRADICTION(진위 지위) — 강의는 역할 역전=거짓처럼 제시 | 중/저/저 | distractors n=2 note vs c7·c10 |
| 7 | 34 원리 | principle: 완성 명제 전체로 판단, when_not 2개 | c1·c12 "부정어 뒤 빈칸은 지문이 거부하는 견해" | PARTIAL_OVERLAP — 강의 요령이 한정 없이 일반화 | 중/중/저 | principle.when_not |
| 8 | 34 ①④⑤ | false/polarity notes | c6·c8·c9 | SEMANTIC_SIMILAR | 고/고/고 | |
| 9 | 22 ① | 6·9·10번 처방, 두 축 | c5·c6 | SEMANTIC_SIMILAR | 고/고/고 | |
| 10 | 22 ③ | truth:"true", fails: 7번 진단(부분 사실) ≠ 요지 | c8·c11 "부분 사실…결론은 그 뒤에서" | SEMANTIC_SIMILAR. 단 선지 "협력을 과소평가하기 쉽다" vs 원문 "less collaborative"(행동) 동일성은 NOT_VERIFIED | 중/고/중 | DB choices[2], 원문 7번 |
| 11 | 22 c4 | — | "This means 문장이 6·9번" | 원문 확인: 6번 "This means a careful…", 9번 "This means it might…" 일치 | — | SQL passage |
| 12 | 전 문항 | meanings m1~m6 | vocab cue | INTENTIONAL_VARIANT(어휘 목록 vs 의미 범위) | 저/저/— | |
| 13 | 34 선지 전문 | — | LECTURE_CONTRACT.md:36 "선지 전문은 미확보" | CONTRADICTION(자료 상태): DB `csat_items.choices` 에 34번 5개 선지 전문 존재 | — | SQL 결과 |
| 14 | 비교쌍 | 34 비교쌍(①/③) | — | DATA_GAP (0쌍, 생성하지 않음) | — | 지시문; 생성 금지 |

## 2026-38 C1 — `these` 지시 범위 (원문 판단)

원문(SQL): 1=주어진 문장 "Sometimes these internal narratives we form …", 4="As storytelling creatures, we routinely form narratives…", 5="…our minds seek to make sense of them by forming stories…", 6="For example, … you may create a negative narrative…", 7="Suddenly, you judge everyone…", 8="For example, the narratives you have formed around gun control…— who you are as an individual."
- 원문이 지지하는 것: "narratives we form"의 선행 개념은 4번에서 일반 진술로 처음 등장하고(5번 forming stories), 6~7번은 그 구체 사례다. ⑤ 자리 앞에는 4~7번 전체가 놓이므로 `these`를 6~7번만으로 한정할 문면 근거는 없다. 원본 decisive는 "6~7번에서 실제로 만들어진 서사를 받고"로 '유일' 이라고 쓰진 않았지만 sentences=[1,6,7,8]과 강의 c5가 결합되어 좁은 범위로 읽힌다 → **과잉 한정(P1)**. C1 후보의 4~7 포괄 해석은 원문과 정합하나 미승인이며, 평가원 공식 해설 아님(CORRECTION.md:17이 스스로 명시).
- 정답 ⑤·n_a·satisfies는 원문으로 유지된다(8번 For example이 받칠 identity 일반 진술은 주어진 문장뿐 — m6 note).
- 미수정: 원본·DB·후보 모두 손대지 않았다.

## CONFLICT_REGISTER

| ID | 등급 | 문항/위치 | 유형 | 내용 | 근거 | 상태 |
|---|---|---|---|---|---|---|
| CC-01 | P1 | 38 ⑤ decisive + 강의 c5 | CONTRADICTION(범위) | `these`를 6~7번 사례에 묶음; 원문은 4~7 서사 형성 담화 전체를 허용 | 원문 4~7번, C1_CANDIDATE | C1 후보 미승인 |
| CC-02 | P1 | 34 강의 c7·c10 | CONTRADICTION(진위) | 분석 ② unknown vs 강의 "법은 방어받는 쪽"·"주체 역전" → 거짓 단정처럼 전달 | inquiry 34 n=2 note | 미조치 |
| CC-03 | P1 | 34 c1·c12 | 과잉 일반화 | "부정어 뒤 빈칸=지문이 거부하는 견해"; If/Ideally 조건 생략 | m2·m3 scope, principle.when_not | 제안 v6-design-1 미승인 |
| CC-04 | P1 | 38 c1·c12 및 analysis principle | 과잉 일반화 | "짝 없는 예시 앞=자리"; 분석 when_not 한정이 강의에서 사라짐 | LECTURE_CONTRACT.md:40 | 제안 미승인 |
| CC-05 | P1(공개 정책) | 34 c4·c5, 22 c5, 38 c4 | 직접 누설 | "정답은 삼/일/오 번입니다" | LECTURE_CUES | OFFICIAL_ANSWER 동의 시만 허용 필요 |
| CC-06 | P2 | 38 c1, 22 c11, 34 c10, 38 c10 | 간접 누설 | 답 위치 규칙·함정 선지 번호 명시로 소거 가능 | LECTURE_CUES | 검수 필요 |
| CC-07 | P1(데이터) | DB 2026 38 `choices` | DATA 결함 | 선지 칸에 위치기호 대신 본문 문장 조각, ⑤에 각주·쪽번호 "* anecdote… 7" 혼입 | SQL 결과 | 수정 안 함, 원본 PDF 대조 NOT_VERIFIED |
| CC-08 | P2 | LECTURE_CONTRACT.md:36 | 자료 상태 불일치 | "34 선지 전문 미확보" vs DB 선지 전문 존재 | SQL | 확인 필요(공식 원문 대조는 NOT_VERIFIED) |
| CC-09 | P2 | 22 ③ | NOT_VERIFIED | content_truth=true 단정: "과소평가하기 쉽다" ≈ "less collaborative" 동일성 미검증 | DB choices, 원문 7번 | 감수 필요 |
| CC-10 | P2 | 전체 | VERSION_DRIFT | analysis_version 5 / lecture v2·v3 / proposal_revision 결속 없음 | LECTURE_CUES.versionBinding | 계약상 미입증 |

## 의미지원 schema 검증 vs 내용 감수 혼동

- `meaning-support/data.ts:59` 주석 "검수 · schema 가드" 는 contentHash 16hex 일치·형식만 확인한다(65-66행). 내용 정확성 판정이 아니다.
- `inquiry-drain-build.mjs:11-13`의 `review:"verified"` = 현재 해시에 묶인 독립 pass·검수자≠작성자·기준 버전 일치. 세 문항 모두 verified인데 CC-01·CC-02가 남아 있다 → **verified 라벨을 "내용 결함 없음"으로 읽으면 혼동**. 강의는 반대로 `contentValidation:"NOT_VERIFIED"`. 두 라벨이 같은 화면에 함께 나오면 학습자/운영자가 같은 수준의 감수로 오인할 위험(위험 판단은 추론).
- CORRECTION.md:86-108은 "테스트 통과를 내용 감수 PASS로 만들지 않는다"고 명시해 분리 원칙은 문서에 존재.
