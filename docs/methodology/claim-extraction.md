<!-- docs/methodology/claim-extraction.md -->
# 강사 영상 → 주장 단위 추출 형식

작성 2026-10-01 · 합의: Codex 리뷰(2026-10-01) · 검증기 `scripts/knowledge/claims-lib.mjs` · 적재기 `scripts/knowledge/claims-import.mjs`.
등록부 체계는 [SYSTEM](./SYSTEM.md). 이 문서는 **영상에서 뽑은 것을 등록부에 넣기 전의 계약**이다.

## 원칙

- **한 줄 = 주장 하나.** 영상 하나가 아니다. 한 영상에서 권고가 셋이면 세 줄이다.
- **요약에서 추론해 채우지 않는다.** 원문(자막·영상)과 대조한 것만 적는다. 대조하지 못했으면 `hold` 로 남긴다.
- **수업 순서를 강사의 권고로 바꾸지 않는다.** 강사가 「이렇게 하라」고 말한 것(권고)과, 수업이 그렇게 진행된 것(관찰)은 다른 주장이다.
- **원문을 적지 않는다.** 방법·절차·구간은 전부 재서술이다. 구간 재서술은 300자 이내.
- **A 는 위치 대조를 뜻한다.** 그 주장을 영상의 초 구간까지 대조했다는 뜻이지, 효과가 과학적으로 검증됐다는 뜻이 아니다(효과는 항목의 `efficacy` 칸이 따로 다룬다).

## 검증기가 보장하지 않는 것

`claims-lib` 의 검증은 **형식**이다. 통과했다고 확인된 방법이 아니다.

- 절차가 실제로 실행 가능한지 — 「영상이 강좌 구성을 소개한다」 같은 문장도 형식상 통과한다(회귀 테스트로 이 한계를 고정해 두었다).
- 원문을 옮겨 적지 않았는지 — 구간 재서술 300자 제한은 긴 인용을 줄일 뿐 복사를 막지 못한다.
- 구간 재서술이 그 초 구간의 내용과 맞는지.

셋 다 원문을 가진 **검토자**가 판정하고, 판정한 사람은 `reviewer` 에 남는다.

## 필드 (jsonl 한 줄)

| 필드 | 값 | 필수 |
|---|---|---|
| `videoId` | YouTube 영상 ID 11자 | 항상 |
| `claimId` | `<videoId>#<번호>` — 재실행해도 같아야 한다(등록부 slug 가 여기서 나온다) | 항상 |
| `kind` | `recommendation` 명시적 권고 · `observation` 수업 진행 관찰 · `inference` 분석자 추론 | 항상 |
| `method` | 방법 문장(재서술) | `import` |
| `procedure` | 실제 실행 절차 단계 배열(1개 이상, 재서술). 소개·구성 설명은 절차가 아니다 | `import` |
| `skill` | 영역 분류 id 배열(`skill:*`) 또는 `"미명시"` — 빈 배열 금지 | 항상 |
| `audience` | 대상 id 배열(`age:*` · 숙련도) 또는 `"미명시"` | 항상 |
| `conditions` | 조건 id 배열(`exam:*` · `process:*` · 문항 유형) 또는 `"미명시"` | 항상 |
| `segment` | `{ startSec, endSec, paraphrase }` — **대조한** 구간과 그 재서술. 자막 전체의 시작·끝이나 문자 위치를 쓰지 않는다. 대조 못 했으면 `null` | A 등급 |
| `reviewScope` | `full` 전체 열람 · `excerpt` 발췌 검토 — 등급과 별개 기록 | 항상 |
| `grade` | `A` 구간 대조 · `B` 영상·채널 신원 확인, 구간 미대조 · `C` 같은 주장을 다른 출처에서 | `import` |
| `verdict` | `import` 적재 · `hold` 보류 · `exclude` 제외 | 항상 |
| `reason` | 보류·제외 사유 | `hold`·`exclude` |
| `reviewer` | 누가 대조했는가 | 항상 |

분류 id 는 DB `methodology_taxonomy`(최신 스냅샷)의 실제 값만 받는다. 차원이 틀리면(예: `skill` 칸에 `age:high`) 거부한다.

## 등록부로 들어가는 모양

| 주장 | 등록부 |
|---|---|
| `import` + 검증 통과 | `knowledge_items` 공부법(L4) · 상태 「추출됨」 · slug `yt-<sha1(claimId) 12자>` |
| `kind` | 근거 귀속: 권고 → `stated` · 관찰 → `observed` · 추론 → `inferred` |
| `segment` | 근거 위치 `m:ss–m:ss` · 링크 `watch?v=<id>&t=<startSec>s` · 메모에 구간 재서술 |
| 이미 같은 slug 가 있음 | **건너뛴다** — 사람이 바꾼 판정·문장을 덮지 않는다 |
| `hold`·`exclude`·검증 실패 | 적재하지 않고 사유와 함께 센다 |

관찰(`observed`) 귀속은 migration `20261001130000_knowledge_evidence_observed` 적용 뒤 `--observed-ok` 로 받는다.

## 실행

```
# 후보 목록 + 검토 틀(요약 기반 — 검토 전)
node scripts/knowledge/yt-import.mjs <추출 폴더> <출력 폴더>

# 검토가 끝난 주장 파일 미리보기(DB 쓰기 없음) → 확인 뒤 --commit
node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/knowledge/claims-import.mjs <claims.jsonl> <출력 폴더> [--commit] [--observed-ok]
```

검증 회귀: `node --test scripts/knowledge/__tests__/claims-lib.test.mjs`.

## 현황 (2026-10-01)

- Codex 요약 196편 중 학습 절차가 적힌 영상 13편 → Codex 재검토로 3편은 절차가 아님(제외) · 10편은 **원문 대조 전 보류**
- 절차 미추출 145편 · 주제상 제외 36편 · 자막 부족 2편
- 등록부에 적재된 강사 영상 주장: **0**
