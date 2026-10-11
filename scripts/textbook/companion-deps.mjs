// scripts/textbook/companion-deps.mjs
// Companion resources file (only when an order seals companion activities):
// { antonyms: {word: [..]}, pos: {word: pos}, common_words: [..] | null, word_pool: [{word, meaningKo, rhymeKey}],
//   audio: {word: {url, attribution}} }. Missing parts block only the activities that need them.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const companionBytes = file => fs.readFileSync(path.resolve(file), 'utf8')

export function companionDeps(file) {
  if (!file) return {}
  const raw = JSON.parse(companionBytes(file))
  return {
    ...(raw.antonyms || raw.pos ? { lexicon: { antonymsOf: word => raw.antonyms?.[word] ?? [], posOf: word => raw.pos?.[word] ?? null } } : {}),
    ...(raw.common_words !== undefined ? { isCommonWord: word => raw.common_words === null || raw.common_words.includes(word.toLowerCase()) } : {}),
    ...(raw.word_pool ? { wordPool: raw.word_pool } : {}),
    ...(raw.audio ? { audioOf: word => raw.audio[word] ?? null } : {}),
  }
}

export const companionResourcesSha256 = file => file ? createHash('sha256').update(companionBytes(file)).digest('hex') : null
