# tasks/

작업 명세(spec) JSON 을 두는 곳. 등록은 `node bin/vfc.mjs task add --file tasks/<이름>.json` — 등록된 작업의 정본은 `state/TASK_QUEUE.json` 이다.
필수 필드와 의미: [docs/DATA_CONTRACT.md](../docs/DATA_CONTRACT.md).
