# Vocaflow — 멀티 세션 worktree 가이드

> 여러 Claude Code / VS Code 세션이 **서로 다른 화면·기능을 동시에** 작업할 때의 git worktree 운영 가이드.
> 핵심 원칙: **worktree 개수 = 동시에 굴리는 브랜치 개수** (화면 개수가 아님).

---

## 1. 왜 worktree 인가

worktree = **별도 디렉터리 + 독립 워킹트리 + 공유 `.git`**. 각 디렉터리가 자기 브랜치를 가지므로,
세션끼리 `git switch` / `add` / `commit` 이 서로 간섭하지 않는다.

| 상황 | worktree 필요? |
|---|---|
| 세션 1개로 학습자 → 어드민 **순차** 작업 | ❌ 불필요 (브랜치만 전환) |
| 세션 2개가 **같은 브랜치** 작업 | ❌ 금지 (동일 워킹트리 공유 시 인덱스 충돌) |
| 세션 2개가 **서로 다른 브랜치** 동시 작업 | ✅ worktree 사용 |

> ⚠️ 동일 working tree 를 공유한 채 한 세션이 `git switch` 하면, 다른 세션의 `add`/`commit` 이
> 엉뚱한 브랜치로 들어간다 (PR #31 main 직접 commit 사고가 이 패턴). worktree 가 이를 구조적으로 차단.

---

## 2. 현재 레이아웃

| 디렉터리 | 브랜치 | 용도 |
|---|---|---|
| `C:/Users/kille/Vocaflow` | (작업 브랜치) | 메인 체크아웃 (현재 세션) |
| `C:/Users/kille/Vocaflow-main` | `main` | handoff / PR 관리·리뷰 |
| `C:/Users/kille/Vocaflow-ui` | `feat/learner-ui` | 학습자 화면 (`app/(main)/*`) |
| `C:/Users/kille/Vocaflow-admin` | `feat/admin-ui` | 어드민 화면 (`app/admin/*`) |

학습자/어드민은 라우트 폴더가 분리돼 있어 (`app/(main)/` vs `app/admin/`) 병렬 작업 충돌이 거의 없다.

---

## 3. 관리 스크립트 (`pnpm wt`)

`scripts/worktree.mjs` — 생성 시 **`pnpm install` 자동 실행** (worktree 마다 `node_modules` 별도 필요).

```bash
pnpm wt list                  # 전체 worktree + main 대비 ahead/behind
pnpm wt new <suffix> [base]   # ../Vocaflow-<suffix> + feat/<suffix> 생성 + 의존성 설치 (base 기본 main)
pnpm wt remove <suffix> [--del-branch]   # worktree 제거 (브랜치는 기본 보존)
pnpm wt sync                  # git fetch --all --prune 후 상태 요약
```

규약: 디렉터리 = `../Vocaflow-<suffix>`, 브랜치 = `feat/<suffix>`.

예) 결제 화면 작업용 worktree:
```bash
pnpm wt new payments          # → ../Vocaflow-payments [feat/payments] + pnpm install
code ../Vocaflow-payments     # VS Code 새 창
```

---

## 4. 세션 시작 / 종료

**시작** — 각 worktree 디렉터리를 별도 창/세션으로 연다:
```bash
code C:/Users/kille/Vocaflow-ui      # 학습자 세션
code C:/Users/kille/Vocaflow-admin   # 어드민 세션
```
Claude Code 는 각 디렉터리를 working directory 로 인식 → 자기 브랜치에서 자유롭게 작업.

**종료** — 머지 후 정리:
```bash
pnpm wt remove ui --del-branch       # 디렉터리 + feat/learner-ui 삭제
# 또는 브랜치 보존:
pnpm wt remove ui
```

---

## 5. 공유 자산 = 충돌 지점 (반드시 직렬화)

worktree 가 격리해 주지 못하는, **모든 브랜치가 공유하는** 자원:

| 공유 자산 | 위험 | 규칙 |
|---|---|---|
| **클라우드 DB** (`jajenrevcbmrpaliomxv`) + `supabase/migrations/` | 🔴 DB 는 worktree 와 무관하게 단 1개 | 마이그레이션 `apply_migration` 은 **한 세션에서만**. 다른 worktree 는 결과를 `git pull` 로 수령 |
| `packages/ui-shared` · `design-tokens` · `types` | 🟠 공유 컴포넌트/토큰/타입 | 변경은 **작은 PR 로 먼저 머지** → 나머지 worktree 가 rebase 수령 |
| `globals.css` · 루트 `layout.tsx` | 🟡 가끔 겹침 | 동시 편집 시 머지 충돌 주의 |
| `.githooks/` (pre-commit memory-sync) | 🟢 낮음 | `core.hooksPath` 공유 → 모든 worktree 에서 작동. `docs/CONTEXT.md` auto-block 만 변경이라 충돌 영향 작음 |
| **git 인덱스(스테이징)** — 한 worktree 를 두 세션이 함께 쓸 때 | 🔴 인덱스는 worktree 당 1개 | 아래 §5.1 |
| **`.next/`** — 같은 worktree 에서 dev 서버와 `next build` | 🟠 vendor-chunks 혼입 → 라우트 무작위 404 | 검증 빌드는 `NEXT_DIST_DIR=.next-verify` 로 격리 (`next.config.mjs` `distDir`) |

### 5.1 인덱스 공유 사고 — `git add` 와 `git commit` 사이의 창 (2026-08-10 실측)

worktree 는 브랜치를 격리하지만, **같은 worktree 를 두 에이전트 세션이 동시에 쓰면 인덱스는 하나**다.
세션 A 가 `git add` 로 20개 파일을 올려둔 사이 세션 B 가 `git commit` 을 하면,
**B 의 커밋이 A 의 스테이징을 통째로 삼킨다.** 실제로 아케이드 재설계 20파일이
`12a29531 feat(pdcp): 현대화 콘솔 트리거…` 안으로 들어갔고, 그대로 push 됐다.

- 되돌릴 수 없다 — push 된 뒤에는 `--force` 가 필요한데 그건 금지다(§6). **예방만 가능하다.**
- **규칙**: 한 worktree = 한 세션. 두 번째 세션은 `pnpm wt new` 로 자기 worktree 를 만든다.
- 불가피하게 공유한다면 `git add` 와 `git commit` 을 **한 명령으로 붙인다**
  (`git commit -F <msgfile> -- <paths>` · 또는 `git add … ; git commit …` 를 한 호출 안에서).
  창이 좁을수록 안전하다.
- 커밋 직후 `git show --stat HEAD` 로 **내가 넣은 파일만 들어갔는지 확인**한다.
  섞였다면 되돌리지 말고 CHANGELOG 에 커밋 해시를 남겨 추적 가능하게 한다.

---

## 6. push / 머지 동시성

| 동작 | 동시 가능 |
|---|---|
| 각자 다른 브랜치 push | ✅ 무제한 |
| 같은 브랜치 동시 push | ❌ second = non-fast-forward 거부 |
| 다른 PR 머지 | ✅ GitHub 가 직렬화 |
| `main` 직접 push | ❌ **절대 금지** (PR 경유) |
| `--force` push | ⚠️ 사용자 명시 요청 시만 |

각 worktree 는 자기 PR 로 독립 머지 → 다른 worktree 영향 0.

---

## 7. 안전 레일

- 모든 작업 시작 전 `git branch --show-current` 로 현재 브랜치 확인 (메모리 `feedback_handoff_workflow`).
- 각 worktree 는 자기 디렉터리 안에서만 git 작업 — 다른 worktree 경로를 직접 건드리지 않는다.
- `pnpm install` 누락 시 dev 서버가 안 뜬다 → `pnpm wt new` 는 자동 설치, 수동 생성 시 직접 install.
