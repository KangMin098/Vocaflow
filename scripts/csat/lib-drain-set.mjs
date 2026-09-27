// scripts/csat/lib-drain-set.mjs
//
// **분석 드레인이 어느 집합을 다루나** — `--set kice`(기본) | `--set hakpyeong`.
// export · validate · import 세 단계가 같은 값을 써야 한다(한 단계만 다른 원장을 읽으면
// 인용 대조가 엉뚱한 지문과 맞춰진다). 그래서 한곳에서 정한다.
//
//   kice       원장 data/corpus.json            작업 폴더 analysis-drain/
//   hakpyeong  원장 data/corpus-hakpyeong.json  작업 폴더 analysis-drain-hakpyeong/ (gitignore)
//
// 학평 작업 폴더를 따로 두고 추적하지 않는 이유: 청크와 결과에 지문·인용이 실리는데 학평은
// «EBSi 에서만 제공 · 무단 전재 및 재배포 금지» 다. 분석의 정본은 DB(csat_item_analyses)다.

import path from 'node:path'

const i = process.argv.indexOf('--set')
export const SET = i >= 0 ? process.argv[i + 1] : 'kice'
if (!['kice', 'hakpyeong'].includes(SET)) throw new Error(`--set 은 kice | hakpyeong: ${SET}`)

export const CORPUS_FILE = path.resolve('scripts/csat/data', SET === 'kice' ? 'corpus.json' : 'corpus-hakpyeong.json')
export const WORK_DIR = path.resolve('scripts/csat', SET === 'kice' ? 'analysis-drain' : 'analysis-drain-hakpyeong')
