# PLOS 원본 보관 판정 드레인 — 절차

> **판정 기준은 [docs/SOURCE_JUDGMENT_CRITERIA.md](../../docs/SOURCE_JUDGMENT_CRITERIA.md) 하나다.** 여기에는 기준을 쓰지 않는다 —
> 이 파일은 청크를 뽑고, 판정을 맡기고, 적재하는 순서만 적는다.

## 순서

```
# ① 청크 — 읽기 전용 · 이미 보관 판정됐거나 청크에 든 원본은 건너뛴다(재실행 안전)
node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs                 # 예행, 편수만
node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 10

# ② 판정 — 청크마다 csat-source-judge 하나. 판정자는 정본(위 링크)을 먼저 읽는다
#    CHUNK_PATH=scripts/csat/plos-raw-triage/chunk-NN.json  OUT_PATH=…/chunk-NN.out.json

# ③ 검사 → 예행 → 적재(gate.retain 한 키만 더한다 · 같은 판정 재적재는 변경 0)
node scripts/csat/gate-reviews-verify.mjs <chunk-NN.json> <chunk-NN.out.json>
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NN.out.json>
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NN.out.json> --commit
```

## 부르는 쪽이 확인할 것

- 판정자가 입력을 **전부 읽었는가** — 보고에 편당 읽은 분량이 있어야 한다. 앞부분만 본 판정은 보관할 논문의 70%를 버렸다.
- `why` 가 편마다 다른가 — 같은 문장이 여러 편에 붙었으면 그 청크는 다시 판정한다.
- 청크의 보관 비율이 시범(30편 중 22편 보관)과 크게 다르면 적재 전에 표본을 눈으로 본다.
