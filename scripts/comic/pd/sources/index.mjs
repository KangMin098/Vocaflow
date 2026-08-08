// scripts/comic/pd/sources/index.mjs
//
// 어댑터 레지스트리. 새 소스를 붙일 때 **여기와 어댑터 파일만** 추가하면 되고
// 복원·분할·OCR·적재 코드는 손대지 않는다(정규화 intake 경계 덕분).

import { iiif } from './iiif.mjs'
import { internetArchive } from './internet-archive.mjs'
import { localDir } from './local-dir.mjs'

const ADAPTERS = [internetArchive, localDir, iiif]

export function listAdapters() {
  return ADAPTERS
}

export function getAdapter(id) {
  const a = ADAPTERS.find((x) => x.id === id)
  if (!a) {
    throw new Error(`알 수 없는 소스: ${id}\n사용 가능: ${ADAPTERS.map((x) => x.id).join(', ')}`)
  }
  return a
}
