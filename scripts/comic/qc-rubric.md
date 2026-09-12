# 만화 QC 루브릭 — ViStoryBench 정합 + MIN 파이프라인 반영

연구/상용 조사(ViStoryBench·DreamingComics·Dashtoon·Audit&Repair)를 파이프라인 관점에서
"필요한 것만" 골라 반영한 결과. **필요=적용, 오버엔지니어링=미채택**을 명확히 구분한다.

## 채택한 정량 QC 차원 (final-audit.mjs 게이트)

| 차원 (ViStoryBench 계열) | 우리 원장 매핑 | 게이트 |
|---|---|---|
| **캐릭터 일관성 (cross-panel)** ⭐ | `qc-scores.consistency[id]` | **NEW** — 2+ 등장 캐릭터를 함께 보고 얼굴·실루엣·시그니처 동일성 0-10. 미평가/미달-open=**차단** |
| 캐릭터 렌더 품질 (per-panel) | `chapters[n].elements.character` | 기존 — 패널 내 캐릭터 9.5 bar |
| 스타일 유사도 | `chapters[n].elements.art` | 기존 — 잉크/플랫 톤 9.5 bar |
| 프롬프트 정합 (씬 충실) | `elements.scene` + `story`(retention) | 기존 |
| copy-paste/아티팩트 | `defects`(text-leak·중복·color-leak) + `composition` | 기존 — Vision-QC 결함 원장 |

## 이미 구현돼 있던 것 (조사가 "해야 한다"고 한 것 = 이미 완료)
- **Audit & Repair 루프 정식화** = `final-audit.mjs`(SHIP/NO-SHIP 게이트 + 우선순위 리메디에이션 큐 + `--remediate`) + Vision-QC 결함 원장(`qc-defects-*.json`). → 연구의 "다중 에이전트 감사-수정"을 이미 운영.
- **측정 가능(정량)** = 요소별 9.5 bar 점수 + open/accepted-limit/remediated 상태. → "분야가 측정 가능해졌다"를 이미 반영.
- **레이아웃 × identity 우회** = 단일주체 규칙(2+ 캐릭터 패널 = identity 위험 플래그) + HTML 레터링(텍스트 위치를 조판이 해결). → RegionalRoPE 정면돌파 불필요.

## 이번에 반영한 것 (유일한 실제 gap)
**cross-panel 캐릭터 일관성** — 기존 원장은 `character`를 *패널 내 품질*로만 봤고, "같은 캐릭터가
모든 등장에서 동일한가"(ViStoryBench 헤드라인 = 우리 1순위)를 별도 게이트하지 않았다.
`consistency` 원장 + `final-audit.mjs`의 cross-section 블록에 게이트를 추가.

## 일관성 천장 초과 = 캐릭터 LoRA (선택 escalation tier, 필수 아님)
참조-only(현재 기본)는 일관성 천장이 있다(SOTA는 전부 학습 계열). 천장 초과가 필요한 히어로
캐릭터에 한해:
- **자가생성 캐릭터 시트 15~20장으로 캐릭터 LoRA(Kohya) 학습** → 데이터 라이선스 **0**
  (Manga109-s/MangaZero 불필요 — 우리가 만든 이미지로 학습).
- RunPod 4090에서 ~30분. `consistency` accepted-limit → LoRA로 remediated 전환 경로.
- **기본 파이프라인은 참조-only 유지** — LoRA는 상습 드리프트 캐릭터의 escalation(Nano-Pro 배치와 동급의 선택지).

## 미채택 (파이프라인 불필요 / 오버엔지니어링)
- **ViStoryBench 전체 하니스로 리더보드 점수** — 그들의 80스토리·CLIP 메트릭 하니스 이식은 R&E
  전시일 뿐, 제품엔 우리 자체 게이트 + cross-panel 차원으로 충분.
- **DreamingComics 비디오-DiT 프라이어** — 근본적으로 무겁고 다른 경로. 이미지-Edit 유지.
- **RegionalRoPE 레이아웃 정면돌파** — 단일주체+HTML 조판으로 우회 확정.
- **대사 이미지 굽기(TaleDiffusion)** — 우리 HTML 레터링이 우월(편집·다국어·가림0). 역행.

## 운영 흐름
1. 섹션 생성(gen-comfy/gen-qwen) → 2. Vision-QC(패널별 결함 + 요소 점수 → 원장) →
3. **캐릭터별 cross-panel 일관성 평가**(각 캐릭터의 전 등장 패널을 함께 보고 `consistency` 기록) →
4. `node final-audit.mjs --book <x>` → SHIP/NO-SHIP + 리메디에이션 큐 → 5. 재생성/LoRA로 해소.
