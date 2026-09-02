// packages/library-pipeline/src/ingest-article/storyweaver.test.ts
//
// **초·중 지문에 이야기가 0편이던 것을 메우는 소스.** 그래서 여기서 지키는 것은 둘이다:
//   1. 그림책 글이 **글로만** 세어지는가 (뷰어 JS·쪽번호·표지가 섞이면 어수가 부푼다)
//   2. 라이선스를 **모를 때 모른다고 하는가** (짐작해서 CC 를 붙이면 되돌릴 수 없다)
//
// 망을 타지 않는다 — 순수 함수만 검사한다.

import { describe, expect, it } from 'vitest'

import {
  STORYWEAVER_FEEDS,
  storyweaverAuthor,
  storyweaverBookUrl,
  storyweaverLicense,
  storyweaverPageText,
  stripPageNumbers,
} from './storyweaver'
import {
  SOURCE_POLICIES,
  SOURCE_REGISTER_DEFAULT,
  SOURCE_SPECS,
  resolveArticleRegister,
} from './_curation-spec'

/** 실측 형태 — 뷰어가 쪽마다 스크립트를 함께 낸다. */
const storyPage = `
<div class="page"><p>On Sunday, Manu&#8217;s parents got him a red raincoat.</p>
<span class="pn">2/10</span></div>
<script>
  $(document).ready(function() {
    var story_editor = new StoryEditor(new StoryEditorPage(), new StoryEditorService());
    var dictionary = new HTMLContent(); if (story_editor) { dictionary.load(); }
  });
</script>`

const backMatter = `
This book was made possible by Pratham Books' StoryWeaver platform.
Story Attribution: This story: The Red Raincoat is written by Kiran Kasturia .
© Pratham Books , 2015. Some rights reserved. Released under CC BY 4.0 license.`

describe('StoryWeaver 본문 추출', () => {
  it('스크립트를 낱말로 세지 않는다', () => {
    const t = storyweaverPageText(storyPage)
    // 이걸 안 지우면 231어짜리 책이 997어로 나와 교재 창 밖으로 밀려난다(실측).
    expect(t).not.toMatch(/StoryEditor|document|function/)
    expect(t).toContain('On Sunday')
  })

  it('HTML 엔티티를 사람이 읽는 글자로 되돌린다', () => {
    // &#8217; 가 남으면 낱말 경계가 깨져 어수와 문항이 함께 틀어진다.
    expect(storyweaverPageText(storyPage)).toContain('Manu’s')
  })

  it('쪽번호는 글이 아니다', () => {
    expect(stripPageNumbers(storyweaverPageText(storyPage))).not.toMatch(/\b2\s*\/\s*10\b/)
  })
})

describe('StoryWeaver 라이선스', () => {
  it('책 뒷장에서 CC BY 4.0 을 읽는다', () => {
    expect(storyweaverLicense(backMatter)).toBe('CC-BY-4.0')
  })

  it('NC·SA 도 구분해 읽는다 — 등급이 다르면 발행 가능 여부가 다르다', () => {
    expect(storyweaverLicense('Released under CC BY-NC 4.0 license.')).toBe('CC-BY-NC-4.0')
    expect(storyweaverLicense('Released under CC BY-SA 4.0 license.')).toBe('CC-BY-SA-4.0')
  })

  it('못 읽으면 null 이다 — 짐작해서 CC 를 붙이지 않는다', () => {
    expect(storyweaverLicense('© Pratham Books, 2015. All rights reserved.')).toBeNull()
    expect(storyweaverLicense('')).toBeNull()
  })

  it('저작자를 읽는다 — CC BY 는 표시가 의무다', () => {
    expect(storyweaverAuthor(backMatter)).toBe('Kiran Kasturia')
    expect(storyweaverAuthor('저작자 표시가 없는 뒷장')).toBeNull()
  })
})

describe('StoryWeaver 배선', () => {
  it('적중 0% 인 Level 3 이상은 피드 목록에 없다', () => {
    // 실측: L3 중앙 738어 · 초·중 창 적중 0%. 목록에 두면 고를 수 있게 되고,
    // 고르면 창 밖 글만 쌓인다.
    expect(STORYWEAVER_FEEDS.map((f) => f.level).sort()).toEqual(['1', '2'])
  })

  it('register 기본값이 narrative 다 — 이 소스를 넣은 이유 자체다', () => {
    expect(SOURCE_REGISTER_DEFAULT.storyweaver).toBe('narrative')
  })

  it('처리 단계가 실제로 부르는 함수도 narrative 를 돌려준다', () => {
    // ⚠️ 표에 'narrative' 라고 적혀 있는 것과 **처리 경로가 그 표를 읽는 것**은 다른 일이다.
    //   `dev-process` 는 `resolveArticleRegister(source, feed_id)` 를 부르고 그 값을 저장한다.
    //   이 연결이 끊기면 글은 정상으로 들어오고 register 만 null 이 되어,
    //   **"이야기 지문을 넣었는데 narrative 재고가 그대로 0"** 이라는 조용한 실패가 된다.
    expect(resolveArticleRegister('storyweaver', null)).toBe('narrative')
    expect(resolveArticleRegister('storyweaver', 'level-1')).toBe('narrative')
    expect(resolveArticleRegister('storyweaver', 'level-2')).toBe('narrative')
  })

  it('초급 밴드를 겨냥한다', () => {
    expect(SOURCE_SPECS.storyweaver.targetLevels).toContain('beginner')
    expect(SOURCE_SPECS.storyweaver.targetCefr).toEqual({ min: 'A1', max: 'A2' })
  })

  it('정책 표에 자리가 있다 — 빠지면 UI 표에서 조용히 사라진다', () => {
    expect(SOURCE_POLICIES.storyweaver.source).toBe('storyweaver')
    expect(SOURCE_POLICIES.storyweaver.licenseClass).toBe('cc_by')
  })

  it('발행일이 없는 소스라 recency 를 끈다', () => {
    // 그림책에는 발행일이 없다(null). recency 를 켜 두면 **전량이 0점**이 되어
    // 큐레이션이 통째로 걸러 낸다 — 소스를 넣고도 한 편도 안 들어오는 실패다.
    expect(SOURCE_SPECS.storyweaver.maxItemsPerBatch).toBe(24)
  })

  it('책 주소를 slug 로 만든다', () => {
    expect(storyweaverBookUrl('369-the-red-raincoat')).toBe(
      'https://storyweaver.org.in/stories/369-the-red-raincoat',
    )
  })
})
