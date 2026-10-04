// packages/library-pipeline/src/ingest-article/research-origin.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { htmlToPlainText, decodeEntities } from './_helpers'

export const researchBodyHash = (text: string): string =>
  createHash('sha256').update(text).digest('hex')

/** DOI comparison is case insensitive; punctuation at the end of a citation is not DOI data. */
export function normalizeResearchDoi(value: string): string | null {
  const text = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
  let doi = text.replace(/[.,;]+$/, '').toLowerCase()
  // Citation wrappers are not part of the DOI; balanced parentheses inside its suffix are.
  while (doi.endsWith(')') && (doi.match(/\)/g)?.length ?? 0) > (doi.match(/\(/g)?.length ?? 0))
    doi = doi.slice(0, -1).replace(/[.,;]+$/, '')
  return /^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/.test(doi) ? doi : null
}

export function frymStudentDoi(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'kids.frontiersin.org') return null
    return parsed.pathname.match(/^\/articles\/(10\.3389\/frym\.\d{4}\.\d+)\/full\/?$/i)?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const researchOriginSchema = z.object({
  version: z.literal(1),
  student_url: z.string().url(),
  student_doi: z.string(),
  body_hash: hash,
  page_hash: hash,
  checked_at: z.string().datetime({ offset: true }),
  status: z.enum(['declared_original_source', 'no_explicit_original_source', 'original_source_without_doi']),
  section_text: z.string(),
  relations: z.array(z.object({
    original_work_id: z.string(),
    research_url: z.string().url(),
    evidence: z.string().min(8),
  }).strict()),
}).strict().superRefine((value, ctx) => {
  if (frymStudentDoi(value.student_url) !== value.student_doi)
    ctx.addIssue({ code: 'custom', message: 'student URL/DOI mismatch' })
  const seen = new Set<string>()
  for (const relation of value.relations) {
    const doi = normalizeResearchDoi(relation.original_work_id)
    if (!doi || doi !== relation.original_work_id || doi === value.student_doi || doi.startsWith('10.3389/frym.') || seen.has(doi))
      ctx.addIssue({ code: 'custom', message: 'invalid, duplicate or student DOI' })
    if (!/^Original\s+Source\s+Articles?\b/i.test(relation.evidence) ||
        relation.research_url !== `https://doi.org/${doi}` || !value.section_text.includes(relation.evidence) ||
        !relation.evidence.toLowerCase().includes(doi ?? '\u0000'))
      ctx.addIssue({ code: 'custom', message: 'research relation has no exact section evidence' })
    if (doi) seen.add(doi)
  }
  if ((value.status === 'declared_original_source') !== (value.relations.length > 0))
    ctx.addIssue({ code: 'custom', message: 'status/relations mismatch' })
  if (value.status === 'no_explicit_original_source' && value.section_text !== '')
    ctx.addIssue({ code: 'custom', message: 'unexpected source section' })
  if (value.status === 'original_source_without_doi' && value.section_text.length < 8)
    ctx.addIssue({ code: 'custom', message: 'missing original source section' })
})
export type ResearchOrigin = z.infer<typeof researchOriginSchema>

function attribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? null
}

/** Reads only the publisher's explicit source section, before learning-body cleanup removes it. */
export function extractFrymResearchOrigin(input: {
  html: string; container: string | null; studentUrl: string; body: string; checkedAt: string
}): ResearchOrigin {
  const { html, container, studentUrl, body, checkedAt } = input
  const studentDoi = frymStudentDoi(studentUrl)
  if (!studentDoi || !container || !body.trim()) throw new Error('FYM page/body identity is missing')
  // FYM serves og:url, not citation_doi. Never infer page identity from a related link.
  const metaUrls = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .filter(([tag]) => attribute(tag, 'property')?.toLowerCase() === 'og:url')
    .map(([tag]) => attribute(tag, 'content'))
  if (metaUrls.length !== 1 || frymStudentDoi(decodeEntities(metaUrls[0] ?? '')) !== studentDoi)
    throw new Error('FYM page URL disagrees with requested student DOI')

  const headings = [...container.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
  const sections = headings.flatMap((heading, i) =>
    /^original\s+source\s+articles?$/i.test(htmlToPlainText(heading[2]!).trim())
      ? [htmlToPlainText(container.slice(heading.index!, headings[i + 1]?.index ?? container.length)).trim()]
      : []
  )
  const sectionText = sections.join('\n\n')
  const relations: ResearchOrigin['relations'] = []
  for (const section of sections) {
    for (const match of section.matchAll(/\b10\.\d{4,9}\/[-._;()/:a-z0-9]+/gi)) {
      const doi = normalizeResearchDoi(match[0])
      if (!doi || doi.startsWith('10.3389/frym.') || relations.some((r) => r.original_work_id === doi)) continue
      // Keep the whole citation block: the evidence states the relationship, not just an identifier.
      relations.push({ original_work_id: doi, research_url: `https://doi.org/${doi}`, evidence: section })
    }
  }
  return researchOriginSchema.parse({
    version: 1, student_url: studentUrl, student_doi: studentDoi,
    body_hash: researchBodyHash(body), page_hash: researchBodyHash(html), checked_at: checkedAt,
    status: relations.length ? 'declared_original_source' : sections.length ? 'original_source_without_doi' : 'no_explicit_original_source',
    section_text: sectionText, relations,
  })
}

/** Current-body binding; metadata dates do not stand in for the separate article revision. */
export function validateResearchOrigin(value: unknown, sourceUrl: string, body: string, now: number): ResearchOrigin | null {
  const parsed = researchOriginSchema.safeParse(value)
  if (!parsed.success || !Number.isFinite(now)) return null
  const origin = parsed.data
  if (origin.student_url !== sourceUrl || origin.body_hash !== researchBodyHash(body) || Date.parse(origin.checked_at) > now) return null
  return origin
}

/** Attach only to its own complete source body, never to excerpts or another provider. */
export function articleResearchOrigin(article: {
  source: string; source_url: string; content: string; research_origin?: unknown; fetched_at: Date
}): { research_origin?: ResearchOrigin } {
  if (article.research_origin === undefined) return {}
  const origin = article.source === 'frym'
    ? validateResearchOrigin(article.research_origin, article.source_url, article.content.trim(), article.fetched_at.getTime())
    : null
  if (!origin) throw new Error('Research origin is not bound to the article being inserted')
  return { research_origin: origin }
}
