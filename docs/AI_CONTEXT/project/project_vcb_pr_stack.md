> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vcb_pr_stack.md
> category: project

---

**✅ RESOLVED 2026-06-28 — 스택 전부 main 반영 + 좀비 PR 닫음.** 백로그 평가 결과 PR #2~#11·#13~#16·#19 (15개) **전부 head 브랜치가 `origin/main` 에서 도달 가능**(`git merge-base --is-ancestor` 검증) = 내용이 이미 main 에 반영됨. 스택이 하위부터 순차 머지되며 GitHub 가 squash/rebase 로 커밋 identity 소실 탓에 자동 close 못 한 **좀비 PR**이었음. 15개 전부 superseded 코멘트와 함께 close (원격 브랜치 보존). 재머지 불필요 — 아래 "How to apply" 의 스택 머지 주의사항은 이제 historical(닫힌 스택). 신규 VCB 작업은 main 에서 분기.

(이하 historical — 2026-05-17 시점 기록)

The VCB pipeline work has been delivered as a long stacked-PR chain (`feat/wlp-setup` → `feat/vcb-seed-ui` → ... → `fix/vcb-step5-stale-detection` → `feat/shared-dictionary-extension` → `docs/dict-opt-p2-plan` → `fix/wlp-r3-irregular-forms`) — 12+ PRs as of 2026-05-17, none merged to main yet.

**Why:** Each PR represents a discrete pipeline step (P5c.1 … P5c.11 + extensions) sequenced for reviewer comprehension.

**How to apply:**
- Do NOT try to `gh pr merge` a top-of-stack PR onto main directly — its base is the PR below it, not main.
- New work that depends on the stack must branch from the relevant stack tip, not from main (the wlp package, vcb-curate-core, shared_dictionary extensions all live on the stack).
- For "land it safely" requests on a top PR: squash-merge into its current base (preserves stack), explicitly avoid `gh pr merge` against main.
- Rebases inside the stack need `git rebase --onto` against the squashed equivalent on the parent branch, not the original pre-squash SHA.
- See [[project-vcb-cast2000-published]] for the work landing inside this stack.

