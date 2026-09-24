# PLOS 원본 보관 판정 드레인 — 절차

> **판정 기준은 [docs/SOURCE_JUDGMENT_CRITERIA.md](../../docs/SOURCE_JUDGMENT_CRITERIA.md) 하나다.** 여기에는 기준을 쓰지 않는다 —
> 이 파일은 청크를 뽑고, 판정을 맡기고, 일치도를 재고, 적재하는 순서만 적는다.

## 순서

```
# ① 청크 — 읽기 전용 · 전문 · V-Level 낮은 것부터 20편씩
#    이미 보관/내용 판정이 있거나 청크에 든 원본은 건너뛴다(재실행 안전)
node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs                  # 예행, 편수·V-Level 분포만
node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 10

# ② 판정 — 청크마다 csat-source-judge 하나. 판정자는 정본(위 링크)을 먼저 읽고 본문 전문을 끝까지 읽는다
#    CHUNK_PATH=scripts/csat/plos-raw-triage/chunk-NNN.json  OUT_PATH=…/chunk-NNN.out.json
#    열 청크 중 하나는 두 번째 판정자가 따로 판정한다 → OUT_PATH=…/chunk-NNN.b.out.json

# ③ 일치도(두 번 판정한 청크) — 정본 §8
node scripts/csat/gate-reviews-agreement.mjs <chunk-NNN.out.json> <chunk-NNN.b.out.json>
#    어긋난 편은 세 번째 판정자가 전문을 읽고 정한다 → 그 판정으로 chunk-NNN.out.json 을 고친다
#    κ < 0.6 이면 그 배치는 적재하지 않고 멈춘다

# ④ 검사 → 예행 → 적재(gate.retain 한 키만 더한다 · 같은 판정 재적재는 변경 0 — 재실행 안전)
node scripts/csat/gate-reviews-verify.mjs <chunk-NNN.json> <chunk-NNN.out.json>
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NNN.out.json>
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NNN.out.json> --commit
```

## 부르는 쪽이 확인할 것

- 판정자 보고에 **편당 읽은 분량**이 있어야 한다. 전문을 다 읽지 않은 청크는 다시 판정한다.
- 검사기가 같은 `why` 반복을 잡는다 — 걸리면 그 청크는 다시 판정한다.
- 청크 보관 비율이 크게 튀면(같은 V-Level 대의 다른 청크와 20%p 이상 차이) 두 번째 판정자를 붙인다.
- 판정자가 API 안전장치로 멈추면(2026-09-24 chunk-08) 같은 청크를 새 판정자로 다시 돌린다 — 판정 파일이 없으면 적재할 것도 없다.
