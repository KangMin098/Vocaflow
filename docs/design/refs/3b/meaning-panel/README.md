# 3B 참조 대응 — v3.1 원문 이해 패널

> 학습 지도(access-map) 대조와 **별개**다. 그 16/16 결과로 이 패널을 검증하지 않는다.
> 정본 수치: [spec.json](./spec.json) · 변수: `apps/web/src/components/csat/theater/theater.module.css` `.msPanel` 의 `--msp-*` ·
> 가드: `apps/web/src/components/csat/theater/__tests__/meaning-panel-geometry.test.ts` · 실측: `scripts/design/meaning-panel-compare.mjs`.

## 참조 → 우리 부품 대응

| 참조(Skill 모달 · Settings) | 우리(원문 이해 패널) | 같게 둔 것 | 다르게 둔 것(이유) |
|---|---|---|---|
| 첫 카드(제목 + 설명 + 입력) | `ms-head-card` — 전체 이해 · 대조 상태 · 의미/깊이 고르기 | 면 #fbf9f7 · 테두리 #e2e1e0 · 반경 12 · 위 여백 26 · 가로 안쪽 24 | — |
| 카드 사이 흰 틈 | 카드 1 ↔ 설명 카드(`ms-explain`) ↔ 한계 카드 | 16 | — |
| 입력 상자(흰 면 · 1px 테두리) | 구절 대응 행(`ms-phrase` — 영어 구절 → 역할 → 뜻) | 흰 면 · 같은 테두리 색 · 카드 안쪽 24 정렬 | 높이 34 → **44 이상**(누름 대상 — AGENTS.md 44px 규칙) |
| 활성 탭 알약(옅은 면) | 의미 · 깊이 고르기 눌림 상태 | 눌림 면 #f8f7f5 | 높이 30 → **44**(같은 규칙) |
| 보조 알약(Edit file) | 문항 성립 · 설계 재구성으로 이어 가기 · 원래 의미로 돌아가기 | 면 #f4f1ed · 둥근 알약 | 높이 24 → **44**(같은 규칙) |
| 배너 카드 | 문항 성립 · 설계 재구성의 「원문 이해에서 왔어요」(`ms-bridge`) | 한 줄 설명 + 오른쪽 알약 | 테두리를 강조색으로(이어 온 맥락을 색 + 글로 함께 알림) |

측정법: 참조 PNG(gitignore — access-map/README 절차 1)를 Chromium 캔버스로 읽어 세로선 x=1100 · 가로선 y=323 · x=1300/y=245 · x=930 의 색 구간을 쟀다(spec.json `method`). 글자 크기 · 그림자는 이 패널에서 재지 않았다(한계 — `/csat` 공통 `--csat-fs-scale` 을 따른다).

## 실측 대조 (2026-10-12 · dev 서버 · 2026#34 · DPR 1)

`node --env-file=<apps/web/.env.local> scripts/design/meaning-panel-compare.mjs --base http://localhost:3218` — 1280 · 1440 각각 12/12 통과(아래는 1440).

| 항목 | 참조(기대) | 우리 | 판정 |
|---|---|---|---|
| 카드 면 | #fbf9f7 | #fbf9f7 | 통과 |
| 카드 테두리 | #e2e1e0 | #e2e1e0 | 통과 |
| 카드 반경 | 12 | 12.0 | 통과 |
| 카드 사이 간격 | 16 | 16.0 | 통과 |
| 카드 → 구절 행(가로) | 24 | 24.0 | 통과 |
| 카드 위 여백 | 26 | 26.0 | 통과 |
| 구절 행 면 | #ffffff | #ffffff | 통과 |
| 구절 행 높이(참조 34 → 규칙 44) | ≥44 | 66.1(뜻이 두 줄) | 통과 |
| 의미 고르기 눌림 면 | #f8f7f5 | #f8f7f5 | 통과 |
| 의미 알약 높이(참조 30 → 규칙 44) | 44 | 44.0 | 통과 |
| 이어 가기 알약 면 | #f4f1ed | #f4f1ed | 통과 |
| 이어 가기 높이(참조 24 → 규칙 44) | 44 | 44.0 | 통과 |
