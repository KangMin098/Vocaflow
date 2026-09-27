# 규격 L 장면 삽화 (1000 × 400)

> 생성물이다 — `node scripts/design/scene-illustrations.mjs` 가 쓴다. **손으로 고치지 말 것.**
> 규칙 정본 [03-system §3-9](../../03-system.md) · 개념 정본 [symbol-dictionary](../../symbol-dictionary.md) · 결정 DD-62.

## 왜 있나

치환 1회차(2026-09-20)에서 참조 홈의 띠 두 곳이 우리 것으로는 **비었다**. 원인은 팔레트도 카피도 아니라
**규격이 없어서**였다 — 우리 삽화는 S 240 · E 320 · B 640 뿐이고, 셋 다 1360px 컨테이너의 띠를 채우지 못한다.
그래서 §3-9 에 규격 **L 장면 1000 × 400** 을 더하고 그 규격으로 두 점을 그렸다.

## 여기 있는 것

| 파일 | 사전 # | 개념 | 계열 | 동사 | 액센트 한 점 |
|---|---|---|---|---|---|
| `illo-19-shelf-fills.svg` | 19 | 서가가 차오른다 | 서(안정도) | 쌓인다 | 이번 주 꽂힌 책등의 권점 |
| `illo-26-past-papers.svg` | 26 | 해마다의 기출 | 시(시험지) | 넘긴다 | 펼친 해의 도장 |

**개념을 새로 만들지 않았다**(DD-25 조건 2). 둘 다 기호 사전에 이미 있던 행이고, 사전에서 규격 B 였던 것을
띠 하나를 차지하는 장면으로 키운 것이다.

## 골든이 아니다

`docs/design/golden/illustrations/` 의 4점만 스타일 게이트의 **기준 입력**이다(DD-35). 여기 있는 것은 그
기준을 **통과한 산출물**이지 기준이 아니다.

```
node scripts/design/style-gate.mjs docs/design/illustrations/scene --ref docs/design/golden/illustrations
```

마지막 실행 2026-09-20 — PASS 2/2 (선 2종 · 팔레트 5칸 · 액센트 면적 0.01% · 0.06% · 큰 도형 82% · 72% ·
hex 0 · 그라디언트 0 · 금지 소재 0 · Tines 정확 일치 0 · ΔE<2 0).

## 제품 화면에 붙이려면

여기 있는 것은 아직 **복제 시트용**이다(`/dev/replica/ours-home`). 제품 화면에 들어가려면 드레인 3단을
거쳐 `apps/web/src/components/illustrations/generated/` 로 가야 한다(§3-9 「구현 · 드레인」) — 그때
`asset-manifest.json` 의 `concept`·`verb` 와 자리를 함께 정한다.
