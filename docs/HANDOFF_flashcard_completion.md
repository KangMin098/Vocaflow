# 인수인계 — Flashcard 완주 영속화 실패 (진단 중)

> 2026-08-14 기준. 코드 수정 전, **진단만 완료된 상태**.
> 이 문서가 없으면 다음 사람이 배제된 가설을 다시 판다.

## 증상

`apps/web/tests/e2e/05-learner-loop.spec.ts:119` — "Flashcard 완주 시 `scores` 행이 적재된다" 실패.

- **단독 실행에서도 실패** → 계정 오염 아님, **진짜 결함**
- 같은 파일의 다른 2건(ScriptQuiz 완주 · 진단 snapshot)은 통과
- 실패 지점은 `:154` 완주 화면 대기지만, **실제 원인은 그 앞**이다

Playwright 스냅샷상 세션이 **recall 단계에 멈춰** 있다 —
"머리 속에서 뜻을 떠올려보세요" + 미뒤집힌 카드(`카드 뒤집어 정답 확인`).
recall(3초) → `flippable` 전이가 일어나지 않는다.

**이 스펙의 무게**: CLAUDE.md 에 *"완주 결과가 조용히 증발했던 v06.139 결함 재발 방지"*
용으로 명시돼 있다. 빨간불이라는 건 ① 방지 장치만 고장났거나 ② **막으려던 결함이 재발**했거나
둘 중 하나다. 아직 안 갈렸다.

## 배제된 가설 (다시 파지 말 것)

| 가설 | 반증 근거 |
|---|---|
| 스펙 노후 (UI 라벨 변경) | ❌ `떠올렸어요`(FirstJudge.tsx:31) · `기억나요`(SRSBar.tsx:23) · `오늘의 학습이 완료됐어요`(CompletionState.tsx:70) **전부 존재** |
| 타이밍 불일치 | ❌ `RECALL_DURATION_MS = 3000`(FlashcardSession.tsx:32), 스펙은 6초 대기 |
| `aria-hidden` 때문에 셀렉터가 못 잡음 | ❌ `getByRole` 은 `aria-hidden` 하위를 제외하므로 **숨은 동안 안 잡히는 게 정상**이고, `visible=true` 가 되면 정상 매칭된다 |

## 유력 후보 — 마운트 시점 고정 큐

`apps/web/src/hooks/useFlashcardSession.ts:21`

```ts
const [queue] = useState(() => sortByPriority(initialWords))
```

큐가 **마운트 때 한 번 고정되고 이후 갱신되지 않는다.** `initialWords` 가 빈 채로 첫 렌더가
일어나면(데이터 지연 · SSR→클라이언트 전환) 큐는 영구히 비고,

`useFlashcardSession.ts:44` → `const isComplete = currentIdx >= queue.length` → `0 >= 0` = **true**

`FlashcardSession.tsx:103` 의 recall 타이머 effect 가 `isComplete` 로 바로 return 하여
**타이머가 아예 돌지 않는다** — 관찰된 증상과 일치한다.

**단, 확정 아님**: 스냅샷에 실제 카드가 렌더돼 있었으므로(`내 단어장에서` 텍스트)
큐가 비지 않았을 가능성이 있다.

## 다음 단계 (한 줄)

> `apps/web/src/app/(main)/flashcard/play/` 에서 `initialWords` 가 **동기로 채워져 전달되는지** 확인.
> 비동기면 고정 큐가 원인. 동기면 `phase` 상태 전이를 따로 봐야 한다.

핸드폰/클라우드 세션에서도 **코드 읽기만으로 여기까지 가능**하다. 검증(e2e 실행)은 로컬 PC 필요.

## 함께 고칠 것 — 스펙이 진단을 가린다

`05-learner-loop.spec.ts` 카드 루프:

```js
try { await firstJudgeYes.waitFor({ timeout: 6_000 }) }
catch { ...; continue; }   // ← 조용히 넘어감
```

FirstJudge 가 안 뜨면 **16회를 조용히 돌고** 마지막 완주 단언에서야 실패한다.
그래서 에러가 "완주 화면이 없다"로만 나오고 **진짜 원인(전이 실패)이 가려진다.**
96초를 낭비하고 잘못된 곳을 가리킨다.
→ 즉시 실패 + 명확한 메시지로 교체할 것.

---

## 같은 회차의 미분류 항목

전체 e2e 실측(2026-08-14): **128 통과 · 9 실패 · 6 스킵** (31.8분).
`pnpm --filter web exec playwright test` 로 재현.

| 실패 스펙 | 분류 |
|---|---|
| `05-learner-loop` (Flashcard 완주) | ✅ **진짜 결함** — 위 내용 |
| `02-flashcard-session` | ❓ 미분류 |
| `06-echomatch-fakemic` (2건) | ❓ 미분류 |
| `07-arcade-games` (pirate-quest) | ❓ 미분류 |
| `13-arcade-integrity` | ❓ 미분류 |
| `01-wordvault-browse` | ❓ 미분류 |
| `03-admin-curation` | ❓ 미분류 |
| `10-judge-harness` | ❓ 미분류 |
| `10-a11y-sweep` | ⚠️ **격리 문제** — 단독은 통과, 전체 실행에선 실패 |

**분류 방법**: 단독 실행해서 통과하면 계정 오염(`runtime-test-0705` 공유), 실패하면 진짜 결함.

### `10-a11y-sweep` 격리 문제의 파급

여러 스펙이 같은 계정을 쓰며 서로의 화면 상태를 바꾼다.
`.github/workflows/ci.yml` 의 e2e 잡이 **4개를 한 묶음으로 돌리므로 같은 위험**을 안고 있다
(`04-ui-smoke` · `08` · `09` · `10-a11y-sweep`). CI 활성화 전에 검증 필요.

### CI 활성화에 남은 사용자 조치

`.github/workflows/ci.yml` 의 e2e 잡은 **저장소 시크릿이 없으면 조용히 건너뛴다**.
Settings → Secrets 에 등록해야 활성화:
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`

(SERVICE_ROLE 은 full-admin 자격증명이다. 빼고 앞의 두 개만 넣어도 `10-a11y-sweep` 은
DB 단언이 없어 100% 동작하고, `08`·`09` 는 UI 검증만 하고 DB 단언은 graceful 하게 건너뛴다.)
