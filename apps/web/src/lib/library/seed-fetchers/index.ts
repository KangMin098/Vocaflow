import { gutendexFetcher } from './gutendex'
import { standardEbooksFetcher } from './standard-ebooks'
import { wikibooksFetcher } from './wikibooks'
import { librivoxFetcher } from './librivox'
import type { SeedSource, SourceFetcher } from './types'

export * from './types'

export const FETCHERS: Record<SeedSource, SourceFetcher> = {
  gutenberg: gutendexFetcher,
  standard_ebooks: standardEbooksFetcher,
  wikibooks: wikibooksFetcher,
  librivox: librivoxFetcher,
}

export const SOURCE_LABELS: Record<SeedSource, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikibooks: 'Wikibooks',
  librivox: 'LibriVox',
}
