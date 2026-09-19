// packages/library-pipeline/src/ingest-article/voa-boilerplate.test.ts
import { describe, expect, it } from 'vitest'
import { stripVoaBoilerplate } from './voa-boilerplate'
import { parseVoaArticle } from './voa'

const footer = `Download the document below for a lesson plan, video text, and learning activities.
What do you think of this lesson? We want to hear from you. We have a new comment system. Here is how it works:
Each time you return to comment on the Learning English site, you can use your account and see your comments and replies to them.`
describe('VOA observed site boilerplate', () => {
  it('removes the observed footer-only Lesson 13 body', () => {
    expect(stripVoaBoilerplate(footer)).toBe('')
    const html = `<html><div class="wsw">${footer.split('\n').map(p => `<p>${p}</p>`).join('')}</div></html>`
    expect(() => parseVoaArticle(html, 'https://learningenglish.voanews.com/a/1234567.html')).toThrow(/too short/)
  })
  it('keeps lesson dialogue and unknown text on either side', () => {
    const text = `Anna: What do you think of this lesson?\n${footer}\nA new comment system can change a classroom discussion.`
    expect(stripVoaBoilerplate(text)).toBe('Anna: What do you think of this lesson?\nA new comment system can change a classroom discussion.')
  })
  it('does not truncate text after a generic comment invitation', () => {
    const text = 'We want to hear from you.\nThe next section explains what happened.'
    expect(stripVoaBoilerplate(text)).toBe(text)
  })
})
