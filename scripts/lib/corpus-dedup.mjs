// scripts/lib/corpus-dedup.mjs
// Deterministic text evidence. URL/title matches are review hints, never deletion rules.
import { createHash } from 'node:crypto'
export function normalizeCorpusText(text) {
  if (typeof text !== 'string') throw new TypeError('Expected text')
  return text.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\u00ad/g,'').replace(/[^\p{L}\p{N}']+/gu,' ').trim()
}
export function normalizedTextHash(text) {
  const normalized=normalizeCorpusText(text)
  if(!normalized) throw new Error('Empty normalized text')
  return createHash('sha256').update(normalized).digest('hex')
}
export function canonicalSourceUrl(raw) {
  try {
    const url=new URL(raw)
    if(!['http:','https:'].includes(url.protocol)) return null
    url.hash=''
    for(const key of [...url.searchParams.keys()]) if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key.toLowerCase()))url.searchParams.delete(key)
    url.searchParams.sort()
    // Preserve meaningful identifiers, path case, edition and pagination.
    return url.href
  } catch { return null }
}
export function wordShingles(text, width=5) {
  if(!Number.isInteger(width)||width<2)throw new Error('Invalid shingle width')
  const words=normalizeCorpusText(text).split(' ').filter(Boolean), set=new Set()
  for(let i=0;i+width<=words.length;i++)set.add(words.slice(i,i+width).join(' '))
  return set
}
export function compareShingles(left,right) {
  let shared=0
  const [small,large]=left.size<=right.size?[left,right]:[right,left]
  for(const value of small)if(large.has(value))shared++
  return {shared,jaccard:left.size+right.size-shared?shared/(left.size+right.size-shared):null,containment:small.size?shared/small.size:null}
}
export function duplicateEvidence(a,b) {
  const normalizedExact=normalizedTextHash(a.content)===normalizedTextHash(b.content)
  const similarity=compareShingles(wordShingles(a.content),wordShingles(b.content))
  const ua=canonicalSourceUrl(a.source_url),ub=canonicalSourceUrl(b.source_url)
  const ta=normalizeCorpusText(a.title??''),tb=normalizeCorpusText(b.title??'')
  return {normalizedExact,sameCanonicalUrl:!!ua&&ua===ub,sameTitle:!!ta&&ta===tb,...similarity,
    nearReview:!normalizedExact&&similarity.shared>=20&&((similarity.jaccard??0)>=0.8||(similarity.containment??0)>=0.9)}
}
