@echo off
rem bin/main-sync.cmd — Windows 작업 스케줄러(VocaflowMainSync)가 매일 부르는 래퍼. 본체는 bin/main-sync.mjs
cd /d D:\workspace\Vocaflow-AI-Control
if not exist runtime mkdir runtime
node bin\main-sync.mjs >> runtime\main-sync.log 2>&1
rem 끝난 워크트리 정리(규칙 lib/worktree-reap.mjs) → 남은 워크트리의 오래된 검증 빌드 사본 정리.
rem 둘 다 판정 정보를 못 읽으면 아무것도 지우지 않는다. 동기화 결과와 무관하게 돈다.
node bin\worktree-reap.mjs --apply >> runtime\worktree-reap.log 2>&1
if exist D:\workspace\Vocaflow-main-serving\apps\web\scripts\prune-dist-dirs.mjs node D:\workspace\Vocaflow-main-serving\apps\web\scripts\prune-dist-dirs.mjs --root D:/workspace --keep 0 --apply >> runtime\worktree-reap.log 2>&1
