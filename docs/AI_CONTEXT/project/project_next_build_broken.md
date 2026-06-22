> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_next_build_broken.md
> category: project

---

`pnpm --filter web build` (= `next build`)가 **main 에서 이미 실패**한다. 2026-06-23 SRS 작업 런타임 검증 중 발견.

**증상:** 프로덕션 빌드가 webpack 최적화(minify) 단계에서 실패 —
```
0: failed to parse input file
1: Syntax Error
> Build failed because of webpack errors  (Exit status 1)
```
SWC(Rust) 에러체인 포맷, **소스 경로 없음**. 실패 직전 minified 컨텍스트에 onnxruntime 커널명(Attention/Conv/MatMul/Where…)이 보임 → **onnxruntime-web 번들**(EchoMatch v06.33의 piper/onnx 의존) minify 실패가 유력.

**확정:** `feat/wordvault-study-real-a2`(A1.1+A2)와 `main`(Vocaflow-main worktree) **둘 다 exit 1, 동일 에러** → 내 SRS 변경(A1.1/A2/A1.3)과 무관한 **기존 깨짐**. tsc + next lint 는 통과하므로 컴파일은 정상(컴파일 뒤 minify에서 죽음).

**왜 안 들킴:** CI(`.github/workflows/*`)가 typecheck/lint 만 게이트, `next build` 미실행 추정. → 배포 리스크.

**next.config.mjs 현황:** transpilePackages(@vocaflow/*) + images.remotePatterns + dev watchOptions만. **onnxruntime-web/WASM minify 예외 처리 없음.**

**수정 방향(미착수):** ① next.config webpack 에서 ort 청크 minify 제외 또는 asyncWebAssembly experiment + .wasm 처리 ② 또는 onnxruntime-web 를 동적 client-only 로더에서 external 처리 ③ 또는 SWC minify가 못 먹는 vendor 만 Terser fallback. 각 시도마다 build ~2-3분 — 별도 작업으로 권장.

검증 시 worktree 갓차: `.env.local`은 gitignore라 worktree에 없음 → 루트에서 복사해야 build 가능 ([[project_doc_structure_split]] WORKTREE 가이드에 추가 후보).

