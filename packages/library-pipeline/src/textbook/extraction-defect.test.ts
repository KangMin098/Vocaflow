// packages/library-pipeline/src/textbook/extraction-defect.test.ts
//
// **규칙이 조용히 죽지 않게 한다.**
//
// 이 규칙들은 오래 스캔 스크립트 안에만 있었고 시험이 없었다. 시험이 없는 정규식은
// 리팩터링 한 번에 `null` 만 돌려주게 되고, 그러면 **스캔은 "결함 0" 이라는 좋은 소식을
// 출력한다.** 배제 게이트로 쓰기 시작한 이상 그 조용한 실패는 곧 인쇄 사고가 된다.
//
// 그래서 여기서는 두 가지를 잠근다:
//   ① 실측 표본(전수 스캔이 실제로 인용한 문자열)이 걸린다
//   ② **멀쩡한 글은 안 걸린다** — 오탐이 나면 지문을 잃는다
//   ③ 규칙 자체가 사라지거나 무력화되지 않았다(자기무력화 가드)

import { describe, expect, it } from 'vitest'

import {
  DEFECT_RULES,
  allDefects,
  firstDefect,
  isUsablePassage,
  type DefectId,
} from './extraction-defect'

/** 결함이 없는 진짜 지문 — 아래 오탐 검사의 바탕이다. 실제 V5 창(90~200어) 모양. */
const CLEAN = [
  'Honeybees navigate by the sun even on overcast days.',
  'They detect polarized light that passes through the clouds, and this gives them a reliable compass.',
  'When a forager returns to the hive, she performs a waggle dance whose angle encodes the direction of the food.',
  'The duration of the dance encodes the distance.',
  'Other bees read the dance in complete darkness, using touch and vibration rather than sight.',
  'This means the hive can share a map that none of its members has ever seen drawn.',
].join(' ')

const idsOf = (s: string): DefectId[] => allDefects(s).map((d) => d.id)

describe('규칙별 실측 표본', () => {
  it('html-attr — 툴팁 속성이 문장 한복판에 남은 실물', () => {
    const body = `The gravity pulls in everything around it." clicked="0"&gt;supermassive black hole sits at the centre.`
    expect(idsOf(body)).toContain('html-attr')
  })

  it('wiki-markup — 절 표시와 대괄호 링크', () => {
    expect(idsOf('Some prose.\n== Plot ==\nMore prose here.')).toContain('wiki-markup')
    expect(idsOf('Formal reasoning about [[ATP;Kinase]] in cells.')).toContain('wiki-markup')
  })

  it('browser-notice — 추출이 본문 대신 안내문을 가져왔다', () => {
    expect(idsOf('You are using an outdated browser. Please upgrade.')).toContain('browser-notice')
    expect(idsOf('Please enable JavaScript to view this content.')).toContain('browser-notice')
  })

  it('dup-paragraph — 같은 문단이 두 번', () => {
    // 80자 이상이어야 센다. 실물(NASA APOD)이 그랬듯 통째로 되풀이된 경우.
    const para =
      'The nebula glows because hot young stars inside it flood the surrounding gas with ultraviolet light, stripping electrons from hydrogen atoms.'
    expect(idsOf(`${para}\n${para}`)).toContain('dup-paragraph')
  })

  it('dropped-math — 기호만 사라져 문법이 무너진 자국', () => {
    expect(idsOf('Let be a graph with n vertices.')).toContain('dropped-math')
    expect(idsOf('where is the number of edges in the network.')).toContain('dropped-math')
    expect(idsOf('This is bounded by , which completes the proof.')).toContain('dropped-math')
  })

  it('share-chrome — 공유 버튼 줄이 본문에 섞였다', () => {
    expect(idsOf('Facebook Pinterest X LinkedIn Share this story')).toContain('share-chrome')
    expect(idsOf('A 5 min read about coral reefs.')).toContain('share-chrome')
  })

  it('story-seam — 한 발췌 안에서 이야기가 갈렸다', () => {
    // `storySeam` 은 여는 정형구를 쓴 경계만 본다 — 그 계약을 여기서도 확인한다.
    const seam = `${'x'.repeat(200)}. Once upon a time there lived a poor woodcutter and his wife.`
    expect(idsOf(seam)).toContain('story-seam')
  })
})

describe('오탐 — 멀쩡한 글을 잃지 않는다', () => {
  it('깨끗한 지문은 어느 규칙에도 안 걸린다', () => {
    expect(allDefects(CLEAN)).toEqual([])
    expect(isUsablePassage(CLEAN)).toBe(true)
    expect(firstDefect(CLEAN)).toBeNull()
  })

  it('짧은 되풀이 줄은 중복으로 세지 않는다 — 후렴·캡션이 있다', () => {
    // 80자 미만이므로 의도된 되풀이로 본다.
    const refrain = 'And the wheels go round.'
    expect(idsOf(`${refrain}\n${refrain}\n${refrain}`)).not.toContain('dup-paragraph')
  })

  it('정상적인 전치사·관계사 문장을 수식 결함으로 오인하지 않는다', () => {
    const fine =
      'The result was confirmed by three teams, and the ratio of carbon to nitrogen stayed between the expected bounds where it mattered most.'
    expect(idsOf(fine)).not.toContain('dropped-math')
  })

  it('본문에 쓰인 등호·괄호는 위키 마크업이 아니다', () => {
    expect(idsOf('The solution satisfies x = y + 1 under these conditions.')).not.toContain(
      'wiki-markup',
    )
  })

  it('빈 본문은 결함이 아니라 판정 대상이 아니다 — 지어내지 않는다', () => {
    expect(firstDefect('')).toBeNull()
    expect(allDefects('')).toEqual([])
  })
})

describe('firstDefect 는 allDefects 의 첫 항목과 같다', () => {
  it('여러 결함이 겹쳐도 순서가 일치한다', () => {
    const both = `<div>wrapper</div>\nPlease enable JavaScript to continue.`
    const all = allDefects(both)
    expect(all.length).toBeGreaterThan(1)
    expect(firstDefect(both)).toEqual(all[0])
  })

  it('근거 문자열이 비어 있지 않다 — 없으면 다음 사람이 조사를 다시 한다', () => {
    const d = firstDefect('You are using an outdated browser.')
    expect(d).not.toBeNull()
    expect(d!.evidence.length).toBeGreaterThan(0)
  })
})

describe('자기무력화 가드', () => {
  it('규칙 일곱이 모두 살아 있다', () => {
    const ids = DEFECT_RULES.map((r) => r.id)
    expect(ids).toEqual([
      'html-attr',
      'wiki-markup',
      'browser-notice',
      'dup-paragraph',
      'dropped-math',
      'story-seam',
      'share-chrome',
    ])
  })

  it('어떤 규칙도 "항상 null" 이 아니다 — 위 표본 중 최소 하나는 자기 규칙에 걸린다', () => {
    // 규칙 하나가 정규식 실수로 죽으면 스캔은 「결함 0」이라는 좋은 소식을 낸다.
    // 각 규칙이 적어도 한 번은 실제로 발화하는지 확인한다.
    const samples: Record<DefectId, string> = {
      'html-attr': '<div>x</div>',
      'wiki-markup': 'a\n== Plot ==\nb',
      'browser-notice': 'enable JavaScript',
      'dup-paragraph': `${'p'.repeat(100)}\n${'p'.repeat(100)}`,
      'dropped-math': 'Let be a graph.',
      'story-seam': `${'x'.repeat(200)}. Once upon a time there was a king.`,
      'share-chrome': 'Share on Facebook',
    }
    for (const rule of DEFECT_RULES) {
      expect(rule.test(samples[rule.id]), `${rule.id} 가 자기 표본을 못 잡는다`).not.toBeNull()
    }
  })

  it('모든 규칙이 label 과 why 를 갖는다 — 화면이 그대로 보여 준다', () => {
    for (const r of DEFECT_RULES) {
      expect(r.label.length, r.id).toBeGreaterThan(0)
      expect(r.why.length, r.id).toBeGreaterThan(0)
    }
  })
})
