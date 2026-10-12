// scripts/csat/lib-compare-types.mjs
// 비교 공개 목록과 같은 골격의 문항 유형을 재사용한다. 원문 입력은 없어도 되며, 있으면 유형 일치를 검사한다.

export const isInquiryInputFilename = (name) => /^chunk-(inq|v3)-[\w-]+\.json$/.test(name)

/** 골격은 공개 상대 조회의 정본. 로컬 작성 입력이 있으면 서로 다른 유형을 조용히 채택하지 않는다. */
export function buildPairTypeIndex(skeletonDocuments, inputDocuments = []) {
  const types = new Map()
  const put = ({ id, type_id }, source) => {
    if (typeof id !== 'string' || !id || typeof type_id !== 'string' || !/^[RX]-[A-Z0-9]+$/.test(type_id)) {
      throw new Error(`${source}: 문항 id/유형 metadata가 없다`)
    }
    const previous = types.get(id)
    if (previous && previous !== type_id) throw new Error(`${id}: 유형 metadata 충돌 (${previous} / ${type_id})`)
    types.set(id, type_id)
  }
  for (const doc of skeletonDocuments) {
    for (const item of doc.items ?? []) put(item, '공개 골격')
  }
  for (const doc of inputDocuments) {
    for (const item of Array.isArray(doc) ? doc : doc.items ?? []) put(item, '작성 입력')
  }
  return types
}

/** 공개 쌍의 상대 유형이 없으면 전체 build를 멈춘다. null로 적재하거나 해당 쌍을 조용히 버리지 않는다. */
export function requirePairTypes(pair, index) {
  const types = { left: index.get(pair.left.id), right: index.get(pair.right.id) }
  if (!types.left || !types.right) throw new Error(`${pair.pair_id}: 비교 상대의 유형 metadata가 없다`)
  return types
}
