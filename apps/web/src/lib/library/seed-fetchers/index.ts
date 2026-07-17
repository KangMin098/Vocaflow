import { gutendexFetcher } from './gutendex'
import { standardEbooksFetcher } from './standard-ebooks'
import { wikibooksFetcher } from './wikibooks'
import { librivoxFetcher } from './librivox'
import { simpleWikipediaFetcher } from './simple-wikipedia'
import { lit2goFetcher } from './lit2go'
import { storyweaverFetcher } from './storyweaver'
import { pressbooksFetcher } from './pressbooks'
import type { SeedSource, SourceFetcher } from './types'

export * from './types'
export { lit2goGradeToEstVLevel, lit2goInferMaturity } from './lit2go'

export const FETCHERS: Record<SeedSource, SourceFetcher> = {
  gutenberg: gutendexFetcher,
  standard_ebooks: standardEbooksFetcher,
  wikibooks: wikibooksFetcher,
  librivox: librivoxFetcher,
  simple_wikipedia: simpleWikipediaFetcher,
  lit2go: lit2goFetcher,
  storyweaver: storyweaverFetcher,
  pressbooks: pressbooksFetcher,
}

export const SOURCE_LABELS: Record<SeedSource, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikibooks: 'Wikibooks',
  librivox: 'LibriVox',
  simple_wikipedia: 'Simple English Wikipedia',
  lit2go: 'Lit2Go (USF)',
  storyweaver: 'StoryWeaver (Pratham Books)',
  pressbooks: 'Pressbooks (OA 교재)',
}
