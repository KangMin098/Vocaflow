# 측정 코퍼스 드롭 폴더

이 폴더에 `*.txt` 를 넣고 아래를 실행하면 편별 + 합산 커버리지가 나온다.

```bash
npx tsx scripts/extract-coverage/measure.ts scripts/extract-coverage/corpus
```

- 파일명이 리포트의 "편" 이름이 된다 → `S1-gates-outbreak.txt` 처럼 밴드+식별자로 두면 읽기 쉽다.
- `*.txt` 는 `.gitignore` 로 추적하지 않는다. 회차 입력은 각자 로컬에 둔다.
- 골든셋 구성(18편 + 예비 2편)은 [docs/TED_TEST_CORPUS.md](../../../docs/TED_TEST_CORPUS.md) 참조.
