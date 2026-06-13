import { gutendexFetcher } from './gutendex'
import { standardEbooksFetcher } from './standard-ebooks'
import { wikibooksFetcher } from './wikibooks'
import { librivoxFetcher } from './librivox'
import { simpleWikipediaFetcher } from './simple-wikipedia'
import type { SeedSource, SourceFetcher } from './types'

export * from './types'

export const FETCHERS: Record<SeedSource, SourceFetcher> = {
  gutenberg: gutendexFetcher,
  standard_ebooks: standardEbooksFetcher,
  wikibooks: wikibooksFetcher,
  librivox: librivoxFetcher,
  simple_wikipedia: simpleWikipediaFetcher,
}

export const SOURCE_LABELS: Record<SeedSource, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikibooks: 'Wikibooks',
  librivox: 'LibriVox',
  simple_wikipedia: 'Simple English Wikipedia',
}
