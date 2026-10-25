// scripts/lcp/story/story.ts
//
// LCP Story 로컬 제작 CLI — export → (에이전트가 채움) → validate → plan.
// DB · 네트워크 · LLM API 를 쓰지 않는다. import/publish 명령은 없다.
// 계약과 단계: docs/LCP_STORY.md · docs/lcp-story/IMPLEMENTATION.md
//
// 사용(저장소 루트):
//   pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story --work <name> --source <snapshot.json> --policy <policy.json>
//   pnpm exec tsx scripts/lcp/story/story.ts export   --root work/lcp-story --work <name> --stage review
//   pnpm exec tsx scripts/lcp/story/story.ts validate --root work/lcp-story --work <name>
//   pnpm exec tsx scripts/lcp/story/story.ts plan     --root work/lcp-story --work <name> [--out plan.json]
// `work/` 는 저장소 .gitignore 의 `/work/` 로 커밋되지 않는다(원문 전문이 들어가므로 커밋하지 않는다).

import { runStoryCli } from '../../../packages/library-pipeline/src/story/cli'

const code = runStoryCli(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  now: () => new Date(),
})
process.exitCode = code
