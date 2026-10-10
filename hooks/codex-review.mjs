// ~/.claude/hooks/codex-review.mjs  (정본: Vocaflow-AI-Control/hooks/codex-review.mjs · 설치: node hooks/install.mjs)
// Claude Code Stop 훅 — 새 커밋(마일스톤)마다 이 세션이 만진 파일의 커밋 범위를 Codex 로 리뷰한다.
// 판정 규칙(수정 상한 · 최종 리뷰 · 반복 지적 · 판정 기록 · 세션 잠금)은 codex-review-policy.mjs 에 있다 — 여기는 입력·git·Codex 연결만.
//  - 범위 수집(트랜스크립트 · 마지막으로 고친 파일의 워크트리)과 Codex 호출·예산·clean 해시는 기존 codex-review-lib.mjs 를 그대로 쓴다
//    (DB 쓰기 게이트 codex-review-gate.mjs 는 이 파일과 무관하게 그대로 돈다)
//  - 일일 예산 초과 · Codex 실패는 「리뷰 못 함」 = REVIEW_UNKNOWN(통과 아님 · 기준선 유지)
// 끄기: CODEX_REVIEW=0 또는 저장소 루트 .codex-review-off · 설정: CODEX_REVIEW_MAX_FIX_ROUNDS(기본 3) · CODEX_REVIEW_MAX_CHUNKS(기본 4)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { STATE_DIR, MAX_FILES, DAILY_BUDGET, EFFORT, log, collectTouched, buildPrompt, runCodex, markClean, fileKey, overBudget, todayTokens } from './codex-review-lib.mjs';
import { runStopReview, DEFAULTS } from './codex-review-policy.mjs';

const pass = (why) => { if (why) log(`pass: ${why}`); process.exit(0); };

if (process.env.CODEX_REVIEW === '0') pass('disabled by env');let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { pass('no stdin'); }
const { session_id: sessionId, transcript_path: transcriptPath, cwd } = input;
if (!sessionId || !transcriptPath || !existsSync(transcriptPath)) pass('no transcript');

const gitRoot = (dir) => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
// 루트 = 세션이 마지막으로 고친 파일이 속한 git 워크트리(2026-10-04) — 세션 cwd 만 보면 다른 워크트리 변경이 리뷰 없이 통과했다
function lastEditedRoot() {
  const edited = [];
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    for (const c of rec?.message?.content ?? []) if (c?.type === 'tool_use' && ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(c.name)) { const f = c.input?.file_path || c.input?.notebook_path; if (f) edited.push(f); }
  }
  const seen = new Set();
  for (const f of edited.reverse()) {
    let d = dirname(resolve(f)); while (d && !existsSync(d)) { const up = dirname(d); if (up === d) break; d = up; }
    if (seen.has(d)) continue; seen.add(d);
    const r = gitRoot(d); if (r) return r;
  }
  return null;
}
const root = lastEditedRoot() ?? gitRoot(cwd || process.cwd());
if (!root) pass('no git root · review_executed=false');
if (existsSync(join(root, '.codex-review-off'))) pass('disabled by .codex-review-off');
const gitOut = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let head; try { head = gitOut('rev-parse', 'HEAD'); } catch { pass('no HEAD · review_executed=false'); }

const res = runStopReview(
  { sessionId, root, head, touched: collectTouched(transcriptPath, root).repo },
  {
    stateDir: STATE_DIR,
    effort: EFFORT,
    log: (m) => log(`${m} · root=${root}`),
    isAncestor: (a, b) => { try { gitOut('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } },
    mergeBase: (a, b) => { try { return gitOut('merge-base', a, b); } catch { return null; } },
    // git 실패는 null — 정책이 REVIEW_UNKNOWN 으로 본다(빈 값으로 삼키면 리뷰 없이 PASS·clean 이 된다)
    diffNames: (from, to) => { try { return gitOut('diff', '--name-only', `${from}..${to}`).split('\n').filter(Boolean); } catch { return null; } },
    diff: (from, to, files) => { try { return gitOut('diff', `${from}..${to}`, '--', ...files); } catch { return null; } },
    review: (files, diff, kind) => {
      // 예산 초과는 조용한 통과가 아니라 판정 불가 — 기준선을 옮기지 않아 예산이 풀린 뒤 같은 범위를 다시 본다
      if (overBudget()) return { ok: false, why: `일일 예산 초과(오늘 ${todayTokens().toLocaleString()} ≥ ${DAILY_BUDGET.toLocaleString()} 토큰)` };
      const extra = kind === 'final' ? 'This is a READ-ONLY FINAL review after the fix-round limit. Report only remaining P0/P1 defects; do not propose new work.' : '';
      return runCodex(root, buildPrompt(files, diff, extra, root), undefined, kind === 'final' ? 'stop-final' : 'stop');
    },
    // 리뷰한 것은 커밋 범위다 — 작업 트리에 미커밋 수정이 있는 파일은 clean 으로 남기지 않는다(DB 게이트가 리뷰 없이 통과시킨다)
    onPass: (files) => markClean(files.filter((t) => { try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', t], { cwd: root, stdio: 'ignore' }); return true; } catch { return false; } }).map((t) => fileKey(join(root, t)))),
  },
  {
    maxFixRounds: Number(process.env.CODEX_REVIEW_MAX_FIX_ROUNDS ?? process.env.CODEX_REVIEW_MAX_ROUNDS ?? DEFAULTS.maxFixRounds),
    filesPerChunk: MAX_FILES,
    maxChunks: Number(process.env.CODEX_REVIEW_MAX_CHUNKS ?? DEFAULTS.maxChunks),
    maxChunksFinal: Number(process.env.CODEX_REVIEW_MAX_CHUNKS_FINAL ?? DEFAULTS.maxChunksFinal),
  },
);
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
process.exit(res.exit);
