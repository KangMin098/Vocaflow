# 삽화 골든 — 방향 A 「원고지」

> 2026-09-19 고정 · 고른 사람: 사용자(DD-35) · 규칙 [03-system §3-9](../../03-system.md) · 시범 전체 [trial/20260919/report.md](../../trial/20260919/report.md).
> 버린 방향 3: B 「책갈피 끈」 · C 「교정 부호」(주묵 한 획만 A 의 이야기 선으로 흡수) · D 「책등」 — [explore/20260919/compare.md](../../explore/20260919/compare.md).

| 규격 | 골든 | 사전 | 이것이 정하는 것 |
|---|---|---|---|
| **E** 빈 상태 320×200 | [illo-02-text-hub-first.svg](illo-02-text-hub-first.svg) | #2 첫 글을 넣어 보자 | 뼈대 5층이 모두 보이는 기준 — 원고지(큰 도형) · 쪽지(작은 도형) · 1px 이야기 선 · 붓 자국 한 칸(액센트) |
| **S** 스팟 240×240 | [illo-07-coverage.svg](illo-07-coverage.svg) | #7 내가 아는 비율 | 제품 서명(칠해지는 지문)과 같은 몸짓 — 모르는 칸 `--bg2`, 지금 칸 `--ju-wash`, 자 손잡이 권점 |
| **B** 띠 640×240 | [illo-09-review-holds.svg](illo-09-review-holds.svg) | #9 다시 보면 버틴다 | 망각 계열의 기준 — F1 밑줄(3/2/1px)을 데이터 뜻 그대로 `--memory-*` 로 |

**이야기 선 규범 예시**(골든 아님): [norm/illo-10-evidence-points.svg](norm/illo-10-evidence-points.svg) — 사전 #10.
이후 생성물의 이야기 선은 이것을 따른다: 근거 → 목적지 관계를 그릴 때만 주묵 실선+화살표(F2 「지지」) 한 획이고, 그 획이 곧 그 삽화의 액센트다. 관계가 없는 삽화의 이야기 선은 `--t1` 1px.

**쓰는 법**: `node scripts/design/style-gate.mjs <폴더> --ref docs/design/golden/illustrations` — 골든 3점 + 규범 1점이 스타일 게이트의 **유일한** 기준 입력이다(참조 캡처는 넣지 않는다 — brief A2).
