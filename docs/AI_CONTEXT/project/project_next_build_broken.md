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

**수정 완료 → main MERGED (PR #41 = `ee27bad`, 2026-06-28):** next.config.mjs 에 ① `swcMinify: false`(Terser 폴백 → minify Syntax Error 해소, `✓ Compiled successfully`) + ② `eslint: { ignoreDuringBuilds: true }`(드러난 전프로젝트 lint 부채 74건 분리 — typecheck 는 계속 강제) + ③ `ci.yml` 에 `build` job(placeholder env, CI 시뮬 green 확인)으로 재발 가드. 결과: `next build` exit 0, 83 페이지. CI build job PASS(2m4s). **두 원인 모두 pre-existing(minify + lint 이중 깨짐).** main 은 branch protection 없음 → verify(lint) red 여도 머지 가능.

**verify CI 도 기존부터 red → PR #42 로 green (2026-06-28):** `next build` 와 별개로 `verify` job(`turbo run lint typecheck test`)도 상시 red였음. **4가지 독립 사유** 모두 해소: ① web ESLint 에러 74건→0 ② `apps/mobile` lint·typecheck stub(eslint·typescript 미설치 Expo scaffold) ③ `vcb-core`·`library-pipeline` test 에 `--passWithNoTests`(무테스트) ④ `content-storage.test.ts` 의 즉시 createClient 를 `beforeAll` 로 지연(env 없는 CI 에서 skipIf 정상 동작). 패턴: 무테스트/무도구 패키지는 `@vocaflow/wlp` 선례(stub / `--passWithNoTests`) 따름. **CI 가 build 미실행 + verify red 방치로 양쪽 다 silently 깨져있었음** — main branch protection 없어 머지돼 옴.

**후속(미착수):** ① CI 의 `next build` job 은 PR #41 로 추가됨(✅) ② SWC minify surgical 복원(ort 청크만 제외) ③ `next.config` `eslint.ignoreDuringBuilds` 를 다시 false 로(이제 lint 0 이라 안전) ④ `.turbo/*.log` gitignore(현재 추적됨).

**swcMinify 재활성 재검증 (2026-06-28) — 불가 확정, swcMinify:false 유지가 정답:** 사용자가 `Disabling SWC Minifier will not be an option in the next major` 경고 보고 → probe(`swcMinify:true` 빌드)로 **재현**: `Failed to compile`, onnxruntime-web 백엔드 레지스트리 코드(`registerBackend`/`xr=new Map`…)에서 minifier 막힘. 결론: (a) **lazy-load 무효** — `next build`는 async 청크도 minify 하므로 piper-tts-web가 별도 청크여도 SWC가 또 만나 실패. (b) Next 14 swcMinify 경로엔 **per-module minify 제외 API 없음**. (c) 경고는 **무해**(Next 14, 14.2.35; 다음 major 사전공지). **진짜 fix = piper-tts-web/onnxruntime-web를 webpack 번들에서 빼기**(CDN/external 런타임 로드 → EchoMatch 로딩 리팩터) 또는 Next 15(+여전히 CDN 필요). 우선순위 낮음 → 그대로 둠.

검증 시 worktree 갓차: `.env.local`은 gitignore라 worktree에 없음 → 루트에서 복사해야 build 가능 ([[project_doc_structure_split]] WORKTREE 가이드에 추가 후보).

