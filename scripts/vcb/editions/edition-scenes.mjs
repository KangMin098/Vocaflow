// scripts/vcb/editions/edition-scenes.mjs
//
// 에디션 표지를 **Kaggle 무료 GPU 경로**(scripts/design/illo-kaggle.mjs)가 읽는 장면 목록으로 바꾼다.
// DashScope 무료 한도·OpenAI 크레딧이 없을 때의 경로(2026-09-25 실측: 둘 다 소진).
//
//   node scripts/design/illo-kaggle.mjs --scenes scripts/vcb/editions/edition-scenes.mjs \
//     --out apps/web/public/covers/vocab/editions --slug vocaflow-vcb-editions [--only a,b]
//
// 장면 문장은 edition-gen.mjs 와 같은 `promptFor` 로 만든다 — 두 경로의 그림이 갈라지지 않게.
// key:false — 바탕이 그림의 일부(표지는 면을 꽉 채운다). 투명 처리를 하지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { NEG as EDITION_NEG, promptFor } from './edition-styles.mjs'

const prompts = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'work', 'prompts.out.json'), 'utf8'))

export const NEG = EDITION_NEG
export const SCENES = Object.entries(prompts).map(([slug, p]) => ({
  id: slug,
  size: '1328*1328',
  style: '',
  scene: promptFor(p),
  key: false,
}))
