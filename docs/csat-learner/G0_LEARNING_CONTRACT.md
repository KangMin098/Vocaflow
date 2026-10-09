<!-- docs/csat-learner/G0_LEARNING_CONTRACT.md -->
# G0: 기출 학습 세션·시도·완료 데이터 계약

| 항목 | 내용 |
|---|---|
| 확정일 | 2026-10-08 |
| 근거 | [vnext-audit](https://github.com/KangMin098/Vocaflow/tree/docs/csat-vnext-audit/docs/csat-learner/vnext-audit) · ChatGPT 2차 심사 · 사용자 승인 |
| 구현 | G1, `lib/csat/learning-session.ts` |

- **G1(이번 단위)은 이 계약 중 「기기 기록」 부분만 구현합니다.** 서버 정본(`learning_task_attempts`) 부분은 G2에서 b5 통합 세트로 승인받은 뒤 적용합니다.
- 이 계약은 **실제 학습 효과를 말하지 않습니다.** 합성 학습자 검증은 기능 검증일 뿐입니다.

## 1. 개념과 관계

```
Session(학습 세션) 1 ── 0..n Attempt(학습 시도)
  └ 한 학습자가 한 문항(activity=theater)에 들어와 마칠 때까지. 시도가 0건이어도 존재한다.
       Attempt = 판단을 한 번 제출한 것(예측 확정 · 전이 응답 · 복습 응답).
       「해설 먼저 보기」는 시도가 아니다 → 세션의 help_level 로 남는다.
```

| 질문 | 답 |
|---|---|
| 열기만 하고 나간 학습 | 세션은 있고(`stage=open`) 시도는 0건 |
| 「모르겠어요—바로 보기」 | 세션 `help_level=viewed_first`, `stage=revealed`. **시도 없음.** 기존 저장 형식과의 호환 때문에 예측 기록 1건은 남지만 **적중률 분모와 분자에서 모두 빠짐** (§5) |
| 같은 문항을 다시 열면 | 마치지 않은 최근 세션이 있으면 **재개**. 마친 세션뿐이면 완료 화면을 보여 주고, 「처음부터 다시」를 누를 때만 새 세션을 만듦 |
| 재개와 새 시도의 구별 | 재개는 같은 `session.id`를 씀. 새 시도는 새 `attempt id`(uuid)를 씀 |

## 2. 네 축 (닫힌 열거형)

| 축 | 필드 | 값 | 붙는 곳 | 의미 |
|---|---|---|---|---|
| 학습 활동 | `activity` | `theater` · `dissect` · `practice` | 세션 | 어느 기능에서 했나. G1은 `theater`만 씀 |
| 측정 단계 | `phase` | `practice` · `review` · `transfer` · `pre` · `post` · `delayed` | 세션(시도는 상속) | 측정상 무엇인가. 극장의 기본값은 `practice`. `pre`·`post`·`delayed`는 효과 프로토콜에서만 씀 |
| 도움 수준 | `help_level` | `independent` · `hint` · `viewed_first` | 세션 | 어떤 도움을 받았나. 첫 공개 방식으로 한 번 정하고 나중에 바꾸지 않음. `hint`는 예약(G1에는 힌트 기능 없음) |
| 결과 | 시도의 `sentence_hit` · `choice_hit`, 세션의 `completion` | 아래 참고 | 시도·세션 | 무엇이 나왔나 |

`mode` 필드는 **폐기**합니다. 감사 문서 02 §5-1의 `mode`가 맡던 역할은 `activity`와 `phase`로 나뉘었습니다.

### 완료 수준과 전이 결과의 분리
- `completion`은 **저장하지 않고 파생**합니다(일관성 유지 목적).

  | stage | help_level | completion |
  |---|---|---|
  | `open` | 상관없음 | `null` (아직 아무것도 안 봄) |
  | `revealed` (마치지 않음) | 상관없음 | `viewed` |
  | `finished` | `independent` | `independent` |
  | `finished` | `viewed_first` 또는 `hint` | `guided` |

- **전이 결과**는 완료 수준이 아닙니다. 별도 세션(`phase=transfer`)의 시도 결과로 기록합니다. G1에는 전이 과제가 없고, 완료 화면은 「같은 유형 다음 문항」을 안내하는 데까지만 합니다.
- 학습자에게 보이는 문구는 사실만 씁니다.

  | 상태 | 문구 | 통계 |
  |---|---|---|
  | `viewed` | 「해설을 살펴봤어요」 | 적중률 제외 |
  | `guided` | 「도움을 받아 마쳤어요」 | 독립 수행과 분리 |
  | `independent` | 「스스로 판단하고 마쳤어요」 | 독립 수행 |
  | (전이 성공) | 「새 문제에도 적용했어요」 | G2 이후 |

- 예측을 제출했다고 해서 이해했다는 뜻은 아닙니다. 그래서 정확도(`sentence_hit`·`choice_hit`)를 따로 둡니다.

## 3. 세션 레코드 (기기, G1)

`DissectionRecord.sessions?: LearningSession[]` (레코드 `version`은 1 그대로. 서버 CHECK `version='1'`과 호환)

```ts
interface LearningSession {
  id: string            // uuid — 기기가 만듦
  sv: 1                 // 세션 스키마 버전
  item: string          // csat_items.id ('2026#34')
  activity: 'theater'
  phase: 'practice'
  stage: 'open' | 'revealed' | 'finished'
  help: 'independent' | 'hint' | 'viewed_first' | null   // 공개 전 null
  step: number          // 마지막으로 본 강의 단계(0기반) — 재개 위치
  steps: number         // 그때의 단계 수(강의가 바뀌었는지 판별)
  attempt?: string      // 예측 시도 id(client_attempt_id)
  revealedAt?: number   // 처음 공개한 시각 — 두 기기가 다르게 공개하면 먼저 공개한 쪽의 help · attempt 가 이김
  startedAt: number
  updatedAt: number     // 병합 기준
  finishedAt?: number   // 한 번 정해지면 바뀌지 않음
  reviewAt?: number     // 「다시 보기」 예약 시각
  deleted?: true        // 삭제 표시(tombstone)
}
```

- **상태 전이**: `open → revealed → finished`만 허용합니다. 되돌아가지 않습니다. 「처음부터 다시」는 새 세션입니다.
- **완료 멱등**: `finishedAt`이 이미 있으면 다시 마쳐도 기록이 바뀌지 않습니다. 같은 세션의 완료는 최대 1건입니다.
- **복습 예약 멱등**: `reviewAt`이 있으면 다시 예약해도 바뀌지 않습니다. 같은 세션의 예약은 1건입니다.
- **상한**: 최근 300개만 남깁니다. 오래된 순으로, 삭제 표시가 된 것과 마친 것부터 지웁니다.
- **동기화 상태**: 레코드 안에 두지 않습니다. 저장소 메타(`sync-v1`: 마지막 성공·실패 시각)에 두고, 화면은 「이 기기에만 저장 중」을 판단할 때만 씁니다.

## 4. 저장·동기화·충돌

| 규칙 | 내용 |
|---|---|
| 쓰기 직렬화 | 탭 안의 모든 변경은 `updateDissectionRecord(fn)` 하나로 갑니다. 읽기→변경→쓰기를 promise 체인으로 줄 세워, 열람 저장과 확정 저장이 서로 덮지 않게 합니다 |
| 기기 → 서버 | 지금처럼 1.5초 모아서 PUT합니다. 서버는 `mergeDissection`으로 항목 단위 병합을 합니다(서버 코드도 같은 함수) |
| 세션 병합 | `id` 기준. `updatedAt`이 큰 쪽을 택하되 아래 규칙을 덧씌웁니다 |
| 단조 필드 | `stage`는 더 진행된 쪽, `finishedAt`·`reviewAt`·`revealedAt`은 **먼저 정해진 값**, `help`·`attempt`는 **먼저 공개한 사본**(`revealedAt`) 쪽, `step`은 `updatedAt`이 큰 쪽. 상한 정리는 마친 세션부터, 삭제 표시는 마지막까지 남김 |
| 삭제 표시 | `deleted`는 병합 뒤에도 남습니다(합집합에서 부활하지 않음). 화면은 삭제된 세션을 무시합니다 |
| 옛 클라이언트 | `sessions`를 모르는 기기가 PUT해도 서버 병합이 **양쪽 sessions를 id로 합치므로** 세션이 사라지지 않습니다 |
| 예측 중복 | `Prediction.attempt`(uuid)가 있으면 그 값으로 중복을 없애고, 없으면 옛 키 `item\|step\|at`를 씁니다 |
| 다기기 재개 | 화면을 열 때 `loadSyncedDissectionRecord`(서버와 병합)를 씁니다. 다른 기기에서 진행한 단계가 이어집니다 |

## 5. 기존 기록 호환

| 기존 데이터 | 처리 |
|---|---|
| 극장 예측 `source:'theater'`, `sentence=null`, `choice=null` | **「모르겠어요」에서만 생깁니다.** 확정 버튼은 확신도와 함께 근거 또는 정답 중 하나가 있어야 켜집니다(`PredictGate.tsx:40`). 그래서 이 조합은 「모르겠어요」로 단정할 수 있고, 읽는 시점에 `viewed_first`로 해석해 적중률에서 뺍니다. **저장값은 바꾸지 않습니다** |
| 세션 없이 예측만 있는 문항 | 열 때 세션을 만듭니다. `stage=revealed`이고, `help`는 그 예측이 모르겠어요면 `viewed_first`, 아니면 `independent`입니다 |
| 해부 예측 (`source` 없음) | 그대로 둡니다. 적중률에 포함됩니다(지금과 같음) |
| `completed` (해부) | 그대로 둡니다. 세션과 별개입니다 |

## 6. 서버 정본 이관 (G2 · b5 통합 세트 · 미적용)

`learning_task_attempts`에 **시도**만 올립니다. 세션은 다음 둘 중 하나로 정합니다. G2 심사에서 결정합니다.

- **(a) 새 표 없음.** `learning_task_attempts`에 `session_id`를 두고, 시도가 0건인 세션은 **서버에 남기지 않습니다.** 열람만 한 세션은 기기 기록과 `csat_learner_state`에만 남습니다.
- **(b) 경량 세션 표.** 시도가 0건인 세션까지 서버 정본으로 둡니다.

G1의 기기 세션은 두 안 모두로 옮길 수 있습니다(`id`·`sv`·`updatedAt`·삭제 표시 보유).

추가 열 제안 (사용자 결정에 따라 유일 범위 등은 G2에서 확정):

| 열 | 제안 |
|---|---|
| `client_attempt_id uuid` | 유일 제약 `(user_id, client_attempt_id)`. **같은 id에 내용이 다르면 409 충돌로 처리하고 덮어쓰지 않음** |
| `session_id uuid` | 세션 묶음 |
| `activity text` | `check in ('theater','dissect','practice')` |
| `help_level text` | `check in ('independent','hint','viewed_first')` |
| `phase` | 그대로 둡니다(practice·review·transfer·pre·post·delayed로 확장할지는 합의) |
| `item_ref` | 기출이면 `csat_items.id`. 기출이 아닌 과제는 별도 식별자(사용자 결정) |

- **백필**: 기기 기록 중 `attempt` id가 있는 예측만 올립니다. 그 이전(id 없음) 예측은 올리지 않습니다. 시각이 같아도 같은 시도라고 단정할 수 없기 때문입니다.
- **롤백**: 정본 쓰기가 실패해도 기기 기록이 남습니다. 서버 정본은 추가만 하므로 되돌릴 때는 `client_attempt_id` 범위로 삭제합니다.

SQL 초안: [g2-draft/learning_task_attempts_ext.sql](./g2-draft/learning_task_attempts_ext.sql) (미적용 · sha256은 PR 본문에 기재).

## 7. 권한·API 책임
- 기기 기록: 브라우저(`lib/csat/session/store.ts`)만 씁니다. 서버 사본은 `/api/csat/state`가 씁니다(RLS로 본인 행만).
- 정본 시도: **서버만 씁니다**(service_role insert, 정본 RLS 규칙). 극장처럼 클라이언트가 판단하는 시도도 서버 API를 거칩니다. 효과 측정(`transfer`·`post`)용 채점은 서버에서 합니다.

## 8. 이벤트와 합성 계정
- 새 학습 이벤트(`csat_prediction_submitted`·`csat_prediction_skipped`·`csat_session_completed` 등, 감사 02 §6)는 **DB 허용 목록 CHECK가 막습니다.** G1은 이벤트를 내보내지 않습니다. 목록은 b5 통합 SQL 세트에 넣습니다(사용자 결정: 합집합으로 한 번에).
- 중복 방지: 한 번만 나가야 하는 화면 진입 이벤트는 ref 가드로 막습니다. G1에서 `csat_dx_viewed`·`csat_map_viewed`의 StrictMode 중복을 고칩니다.
- 완료 집계는 이벤트 수가 아니라 **세션의 `finishedAt` 유무**로 셉니다.
- 합성 계정: 정본의 `synthetic=true`를 서버가 계정 목록으로 판정합니다(G2). G1의 E2E는 서버 쓰기를 모두 가로챕니다(DB 무쓰기).

## 9. 실패·복구

| 실패 | 동작 |
|---|---|
| IndexedDB 차단 | 메모리 기록으로 학습을 계속합니다. 지금 있는 「이 기기에만 저장 중」 표시를 그대로 씁니다 |
| 서버 PUT 실패 | 기기 기록이 남고, 다음에 열 때 병합하면서 다시 올립니다 |
| 강의 API 실패 | 단계 이동과 완료는 강의 없이도 됩니다. 실패 문구를 표시합니다 |
| 원문 없음 | 해설·완료는 가능합니다. 원문 판단을 하지 않았다는 사실은 `help_level`이 나타냅니다 |
| 세션 부패 (모양 불일치) | 읽을 때 걸러 냅니다(`sv!==1` 또는 필수 필드 없음). 나머지 기록은 그대로 씁니다 |
