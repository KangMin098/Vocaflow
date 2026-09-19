// scripts/textbook/__tests__/corpus-dedup.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalSourceUrl, normalizedTextHash, duplicateEvidence, compareShingles, wordShingles } from '../../lib/corpus-dedup.mjs'
test('normalized evidence finds typography differences across providers',()=>{
  assert.equal(normalizedTextHash('“Today,” she said.\n We’ll go.'),normalizedTextHash('"Today," she said. We\'ll go.'))
  assert.throws(()=>normalizedTextHash('---'))
})
test('tracking is removed but different editions and excerpts remain distinct',()=>{
  assert.equal(canonicalSourceUrl('https://example.org/Read?id=2&utm_source=x#top'),'https://example.org/Read?id=2')
  assert.notEqual(canonicalSourceUrl('https://example.org/Read?id=2'),canonicalSourceUrl('https://example.org/Read?id=3'))
  assert.equal(canonicalSourceUrl('javascript:alert(1)'),null)
})
test('a shared URL and title cannot imply identical passages',()=>{
  const a={title:'Shared book',source_url:'https://example.org/book',content:'One child learned how to tend a garden.'}
  const b={...a,content:'The ship crossed a sea and reached a distant shore.'}
  assert.deepEqual([duplicateEvidence(a,b).sameCanonicalUrl,duplicateEvidence(a,b).normalizedExact,duplicateEvidence(a,b).nearReview],[true,false,false])
})
test('near overlap catches a contained excerpt but not short generic phrases',()=>{
  const words=Array.from({length:45},(_,i)=>`word${i}`).join(' ')
  const a={content:words}, b={content:`A separate introduction precedes this text. ${words} A closing paragraph follows.`}
  assert.equal(duplicateEvidence(a,b).nearReview,true)
  assert.equal(duplicateEvidence({content:'Once upon a time there was a king.'},{content:'Once upon a time there was a child.'}).nearReview,false)
  assert.equal(compareShingles(wordShingles('hi'),wordShingles('hi')).jaccard,null)
})
