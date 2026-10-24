# C 정정 후보 r2 (2026-10-25) — SQL 없음 · 미실행

공식 문제지는 `lib-source-repair.mjs` 의 `repairPdfFolder` 정본 폴더 PDF를 `pdftotext -layout` 으로 확인했다. DB 값은 SELECT 로 읽었다.

| 문항 | 필드 | 현재 DB | 공식 문제지 | 후보 | 확신 |
|---|---|---|---|---|---|
| 2023#32 | passage | `… not unlike trans-missible disease …`(md5 `03a62be1…`) | 줄 끝 하이픈 「trans-」 다음 줄 이어짐(338행) → 낱말은 transmissible | `trans-missible` → `transmissible` 1곳 | 높음 — 줄바꿈 하이픈 |
| 2014B#36 | passage | 끝에 ` [3점] (A) (B) (A) (B)` | 배점·선지 표 머리는 지문이 아니다. 빈칸 표지 (A)(B)는 PDF·DB 모두 지문 안에 있다(399행 「in the (A) direction」) | 끝 꼬리 ` [3점] (A) (B) (A) (B)` 제거 | 높음(꼬리) · 판정 메모 「빈칸 표지 누락」은 이번 대조로 재현 안 됨 |
| 2017#42 | passage | 끝에 `\n\n(A) (B) (A) (B)` | 같은 표 머리(501행 이후). 각주 `* isotope : ** clumsy :` 는 DB 가 저장하지 않는 낱말 풀이 | 끝 꼬리 `\n\n(A) (B) (A) (B)` 제거 | 높음(꼬리) |
| M2606#27 | passage | 표 칸 순서가 「Schedule When What …」 식으로 PDF 읽기 순서와 다름 | 표 안내문 — 칸 배치는 PDF 좌표로만 정할 수 있다 | 표 읽기 순서 재작성 — 별도 설계(표 정본 형식 미정) | 낮음 — 이번 범위 아님 |

## 콘텐츠 후보

- **M1809#35 탐구 메모:** `inquiry-data.json` 의 「7번 문장 끝의 주석 잔여(hallmark · steepability)는 판단에 영향이 없어 무시했다」. 2026-10-25 C-six 적용으로 DB ⑤ 끝 잔여가 없어졌다. 학습자 화면은 공식 PDF(각주가 따로 인쇄됨)를 쓰므로 판정에는 영향이 없지만, 이 메모는 이제 존재하지 않는 데이터를 가리킨다 → 문장 삭제 후보(판정 필드 불변). 공유 콘텐츠 파일이라 이번에 고치지 않음.

## 다음 단계(승인 필요)

2023#32 · 2014B#36 · 2017#42 는 C-six 와 같은 compare-and-set SQL + 복구 SQL + 수리 기록(recipe) 3종으로 만들 수 있다. 만드는 것과 실행은 각각 별도 지시·승인.
