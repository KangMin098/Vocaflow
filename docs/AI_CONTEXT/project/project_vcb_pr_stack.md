> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vcb_pr_stack.md
> category: project

---

The VCB pipeline work has been delivered as a long stacked-PR chain (`feat/wlp-setup` → `feat/vcb-seed-ui` → ... → `fix/vcb-step5-stale-detection` → `feat/shared-dictionary-extension` → `docs/dict-opt-p2-plan` → `fix/wlp-r3-irregular-forms`) — 12+ PRs as of 2026-05-17, none merged to main yet.

**Why:** Each PR represents a discrete pipeline step (P5c.1 … P5c.11 + extensions) sequenced for reviewer comprehension.

**How to apply:**
- Do NOT try to `gh pr merge` a top-of-stack PR onto main directly — its base is the PR below it, not main.
- New work that depends on the stack must branch from the relevant stack tip, not from main (the wlp package, vcb-curate-core, shared_dictionary extensions all live on the stack).
- For "land it safely" requests on a top PR: squash-merge into its current base (preserves stack), explicitly avoid `gh pr merge` against main.
- Rebases inside the stack need `git rebase --onto` against the squashed equivalent on the parent branch, not the original pre-squash SHA.
- See [[project-vcb-cast2000-published]] for the work landing inside this stack.

