# 범위 C — 확정 6건 선지 ⑤ 낱말 풀이 잔여물 (별도 패키지 · 승인 대기 · DB 미적용)

> 범위 A(2017#24 · 2018#24 · M2509#25, 2026-10-24 적용 완료)와 B(2014A#29 · 보류)와 PK 가 겹치지 않는다. 후보 120 · 321 건은 넣지 않았다.

## 대상과 근거

정정 필드는 6건 모두 `public.csat_items.choices[4]`(⑤) 하나다. 지문 · 정답 · 다른 선지는 바꾸지 않는다.
지우는 꼬리는 공식 문제지에 각주로 따로 인쇄된 낱말 풀이다. 추출 과정에서 ⑤ 끝에 붙었고, 일부는 뜻이 빠지거나 순서가 뒤섞였다.

| PK | 지우는 꼬리(현재 DB) | 정정 후 ⑤ 끝 | choices md5 전 → 후 | 공식 문제지 |
|---|---|---|---|---|
| 2025#30 | ` * taint: 더럽히다 ** altruistic: 이타주의의 5`(풀이 + 쪽번호) | `… sharing the winner’s reward.` | `b7c5a422…` → `f8230ca0…` | 2025 짝수형 — 문장 있음 · 풀이 2개 각주로 따로 있음 |
| M1809#35 | ` 특징, 특질 ( 차를) 우려낼 수 있음 * hallmark : ** steepability :`(뜻·낱말 순서 뒤섞임) | `… tightly rolled.` | `0dc1e7cc…` → `a598f33f…` | 201809 — 같음 |
| M2006#35 | ` * contraband: 밀수품 ** tug: 잡아당김` | `… “upset” by the toy.` | `a2b537e7…` → `39d319b9…` | 202006 — 같음 |
| M2106#35 | ` * compact:`(뜻 빠짐) | `… compact communities.` | `89281d41…` → `11632335…` | 202106 — 같음(시험지는 「* compact: 밀집한」) |
| M2206#35 | ` * kin: 친족 ** proximity: 근접` | `… occupational advancement.` | `a4aa1417…` → `1311573e…` | 202206 — 같음 |
| M2209#35 | ` * psychic:`(뜻 빠짐) | `… cost-benefit assessments.` | `02ce114a…` → `2a5004c8…` | 202209 — 같음(시험지는 「* psychic: 심적인」) |

- 확인 방법(2026-10-24): 정정 후 ⑤ 문장을 공식 문제지 pdftotext 정규화 본문에서 찾았다 6/6. 풀이가 시험지 각주로 따로 인쇄됐음을 확인했다 6/6. 왕복(정정 → 복구) md5 일치 6/6 (SELECT).
- 지우는 이유: 수능·모평 지문 802 중 낱말 풀이를 저장한 행이 0 이다 — 이 DB 는 풀이를 저장하지 않는다. 풀이를 보존할 칸을 만드는 것은 별도 설계 결정이다.
- 영향: 6건 모두 수능·모평 → 학평 자동 보류 트리거 해당 없음. 도표 이미지 연결(heads) 0 → 시각 자료 트리거 효과 없음. published 분석 행은 그대로다.
- 다른 인계와의 관계: 2025#30 은 콘텐츠 보류 1건(c11)과, 35번 5건은 강조 결속 인계와 **같은 문항 · 다른 필드**다. 서로 독립적으로 적용할 수 있다.

## 파일 · SHA-256

| 파일 | sha256 |
|---|---|
| `forward.sql` | `d79e119c159450035f2e7814363965f5b3e58900c7133b9d3e3a90074310aa58` |
| `recovery.sql` | `802f21dd8d82402d5632087c72c248bc499d4ed1cc5d4513ea042451bc358919` |
| `check.sql` | `62234cba07df22c54306d8ef32f619a65279cbfaaa765095e30999a5e0526c93` |
| `recipe-C-six.json`(원장 수리 기록 후보 — 승인·적용 뒤 `scripts/csat/data/kice-source-repairs.json` 에 합친다) | `07f4ae75d7cdc49812750c735e5aeb4a00ce56242c8b039d6056f02b11bbc8ae` |

- forward: compare-and-set, 6행이 아니면 전체 롤백. recovery: 정정 후 md5 가 같을 때만 꼬리를 그대로 다시 붙인다.
- 실행 순서(승인 뒤): sha256 재확인 → `check.sql`(before 6) → `forward.sql` → `check.sql`(after 6) → 공식 문제지 재대조 → 수리 기록 합치기.

## 최종 승인 자료 보강 (2026-10-24 재확인 · SELECT 만)

- **현재 상태:** 6행 모두 `before` choices md5 · passage md5 는 check.sql 주석값과 같음.
- **정답 영향 없음:** 바꾸는 칸은 ⑤ 하나, 6건의 정답은 2025#30 ④ · M1809#35 ③ · M2006#35 ④ · M2106#35 ④ · M2206#35 ④ · M2209#35 ③ — 정답 선지가 아니다. `answer` 열은 바꾸지 않는다.
- **분석 영향 없음:** 최신 published 분석(2025#30 v6 · M1809#35 v4 · M2006#35 v4 · M2106#35 v4 · M2206#35 v3 · M2209#35 v3)의 choice_analysis · design_intent · solve_procedure 에 지우는 꼬리 문자열 0건.
- **강의 영향 없음:** 강의 대본의 hallmark · steepability · contraband 낭독은 강의가 스스로 가르치는 어휘 풀이(en-US 조각 + 한국어 뜻)이고 DB 꼬리를 인용하지 않는다. 학습자 화면은 공식 PDF 를 쓴다.
- **탐구 문구 1곳 낡음(정정 뒤):** `inquiry-data.json` M1809#35 「7번 문장 끝의 주석 잔여(hallmark · steepability)는 판단에 영향이 없어 무시했다」 — DB 꼬리를 전제한 메모. 판정에는 영향 없음. 적용 뒤 콘텐츠 정정 후보로 둔다(이번 범위에서 고치지 않음).
- **원장 수리 기록:** `recipe-C-six.json` 6건 중 2025#30 은 로컬 main 수리 목록(94e227dd0)에 **passage** 수리가 이미 있다. C-six 는 **choices** 라 필드가 달라 `mergeSourceRepair` 로 병합한다(새 항목 추가 금지 — 같은 문항 두 항목이 된다).
- **롤백 조건:** forward 는 바뀐 행이 6 이 아니면 전체 예외 · 무변경. recovery 는 정정 후 md5 와 같을 때만, 6 이 아니면 전체 예외.

## 적용 기록 (2026-10-25 · 사용자 승인 「승인」)

- forward.sql sha256 `d79e119c…aa58` 재확인 → 적용 전 6/6 before → 적용 → 6/6 after md5 · passage md5 불변.
- 수리 기록 병합: 로컬 main ff0a5da48(커밋 1f466e8eb) — 5 추가 · 2025#30 필드 병합. 재생성 원장 선지 6/6 = DB.
- recovery.sql 은 실행하지 않음(필요 시 그대로 사용 가능).
