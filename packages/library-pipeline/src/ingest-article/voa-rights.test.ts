// packages/library-pipeline/src/ingest-article/voa-rights.test.ts
// 적재기 경계 — 제3자 기반 각색 크레딧이 있는 글은 PD-Government · collection-default 로 나가지 않는다.
// 원문(본문 · 저자 · 날짜 · 오디오 · source_id)은 그대로 보존한다(DD-75). 고정 HTML — 네트워크 없음.
import { describe, expect, it } from 'vitest'
import { parseVoaArticle } from './voa'
import { rightsTag } from './rights-tag'

const URL_ = 'https://learningenglish.voanews.com/a/scientists-discover-stonehenge-like-circle-in-denmark/7990025.html'
const para = 'Archaeologists in Denmark have found the remains of a large circular structure that is thousands of years old and similar to Stonehenge in Britain. '

function page(credit: string) {
  const ld = JSON.stringify({ '@type': 'NewsArticle', headline: 'Scientists Discover Stonehenge-like Circle in Denmark', datePublished: '2025-03-01T10:00:00Z', author: { '@type': 'Person', name: 'John Russell' } })
  return `<html><head><script type="application/ld+json">${ld}</script></head><body>
<audio src="https://voa-audio.voanews.eu/vle/2025/03/01/a.mp3"></audio>
<div class="wsw"><p>${para.repeat(3)}</p><p>Reuters reported in 2020 that another site was found.</p><p>I’m John Russell.</p><p>${credit}</p></div></body></html>`
}

describe('VOA 적재기 권리 표지', () => {
  it('AFP 기반 각색: 원문 단위 표기(page) · 분류 unknown · 해소 필요 · 원문 보존', () => {
    const { article } = parseVoaArticle(page('John Russell adapted this story based on an AFP report.'), URL_)
    expect(article.license).toContain('Agence France-Presse')
    expect(article.license).not.toMatch(/PD|public domain/i)
    expect(article.license_evidence).toBe('page')
    const tag = rightsTag({ license: article.license, licenseEvidence: article.license_evidence })
    expect(tag.class).toBe('unknown')
    expect(tag.needsResolution).toBe(true)
    // 원문 보존
    expect(article.source_id).toBe('voa:7990025')
    expect(article.content).toContain('Archaeologists in Denmark')
    expect(article.content).toContain('adapted this story based on an AFP report')
    expect(article.author).toBe('John Russell')
    expect(article.audio_url).toBe('https://voa-audio.voanews.eu/vle/2025/03/01/a.mp3')
    expect(article.published_at?.toISOString()).toBe('2025-03-01T10:00:00.000Z')
  })

  it('VOA 단독 작성(본문에 통신사 언급만): 기존 PD-Government · collection-default 그대로', () => {
    const { article } = parseVoaArticle(page('Nancy Steinbach wrote this story for VOA Learning English. John Russell adapted it.'), URL_)
    expect(article.license).toBe('PD-Government')
    expect(article.license_evidence).toBe('collection-default')
    expect(rightsTag({ license: article.license, licenseEvidence: article.license_evidence }).class).toBe('PD')
  })
})
