// scripts/extract-coverage/measure.ts
//
// 추출 커버리지 자동 측정 — "학습자가 넣은 스크립트의 단어 중 몇 %가 학습자원이 되는가".
//
// 이 스크립트는 **판정하지 않는다**. 토큰화 결과와, 클라이언트가 "미매칭"으로 간주해
// pending_words 로 보내게 될 목록을 그대로 출력한다. 사전 해석(resolve_dict_headword)은
// DB 측 질의로 붙여서 평가한다 — 두 단계를 분리해야 어느 쪽이 흘렸는지 귀속시킬 수 있다.
//
// 사용:
//   npx tsx scripts/extract-coverage/measure.ts [샘플경로]
//   → stdout 에 JSON. `words` 를 DB 질의의 unnest 입력으로 쓴다.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { tokenizeText } from '../../apps/web/src/lib/text-extract/tokenize'

const samplePath = process.argv[2] ?? resolve(__dirname, 'sample-talk.txt')
const text = readFileSync(samplePath, 'utf8')

const r = tokenizeText(text)

const charCount = text.length
const rawRunningWords = text.trim().split(/\s+/).length

console.log(
  JSON.stringify(
    {
      sample: samplePath,
      chars: charCount,
      rawRunningWords,
      tokenizer: {
        totalWords: r.totalWords,
        uniqueRaw: r.uniqueRaw,
        uniqueFinal: r.uniqueFinal,
        diagnostics: r.diagnostics,
      },
      words: r.words,
    },
    null,
    2,
  ),
)
