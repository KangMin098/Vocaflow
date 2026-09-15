// packages/library-pipeline/src/textbook/story-seam.test.ts
//
// ⚠️ **아래 문자열은 전부 DB 에서 그대로 꺼낸 것이다**(2026-09-15,
//   `library_articles` 중 gutenberg 발췌 8,410편에서 여는 정형구가 중간에 나타난 33편).
//   지어내면 규칙이 아니라 내가 지은 문장을 검사하게 된다 — 그러면 통과해도 아무 뜻이 없다.
//
//   각 문자열은 DB 에서 「정형구 앞 90자 + 뒤 100자」로 뽑은 창이다. 앞 90자는
//   `storySeam` 이 액자 판정에 쓰는 바로 그 구간이라 그대로 쓸 수 있고, 글머리 150자
//   문턱만 만족시키려고 `pad()` 로 앞을 채운다 — **문턱 말고는 아무것도 바꾸지 않는다.**

import { describe, expect, it } from 'vitest'

import { storySeam } from './story-seam'

/** 앞을 무해한 산문으로 채워 글머리 문턱(150자)을 넘긴다. */
const pad = (seam: string): string =>
  'The road went on between the hedges and nobody spoke for a long while, ' +
  'and the afternoon light lay flat upon the fields as they walked. ' +
  seam

/** 실제로 이야기가 바뀐 자리 — 잡아야 한다. */
const CROSSED: Array<[string, string]> = [
  [
    'Fifty Famous Stories Retold',
    'Tears were in his eyes as he kissed her, and said, "So be it, my child! So be it." There was once a rich old man who was called the Bar-me-cide. He lived in a beautiful palace in the',
  ],
  [
    "Laboulaye's Fairy Book",
    'which he never forgot, and from that time thenceforth he was fortunate, thanks to Miliza. There was once a woman who was left a widow with two children. The elder, who was only her stepdaugh',
  ],
  [
    "Grimm's Fairy Tales",
    'rm again. So the little sister and little brother lived happily together all their lives. There was once on a time, a little girl whose father and mother were dead. She was so poor that she',
  ],
  [
    'The Aesop for Children',
    ' saw how useless it was to try any longer to persuade the Foxes to part with their tails. There was once a Dog who was so ill-natured and mischievous that his Master had to fasten a heavy wo',
  ],
  [
    'Fairy Tales of the Slav Peasants and Herdsmen',
    'u and me, the younger brother had his suspicions but he very wisely kept them to himself. There was once a married pair who loved each other tenderly. The husband would not have given up his',
  ],
  [
    'The Book of Nature Myths',
    ' due Miss Eva March Tappan for her valuable assistance in the final revision of the text. Long, long ago, when the earth was very young, two hunters were traveling through the forest. They h',
  ],
  [
    'The Violet Fairy Book',
    'e too, and ate and drank many good things. I sha’n’t forget that feast as long as I live. Once upon a time the king of the Goldland lost himself in a forest, and try as he would he could not',
  ],
  [
    'The Book of Stories for the Story-teller (①)',
    'e city. The last we heard of them, they were still there and having happy times together. There was once upon a time an old man and an old woman. The old man worked in the fields as a pitch-',
  ],
  [
    'The Book of Stories for the Story-teller (②)',
    'nd it was only to tell her comrades of her remarkable way of gaining the beautiful money. Once upon a time there lived a great giant. He had mighty arms and legs and could carry tons upon hi',
  ],
  [
    'Fifty Famous Fables',
    '. He cried out with pain and dropped his gun. This frightened the dove and she flew away. There was once a very queer family living in the woods. There were four in all--a rat, a raven, a to',
  ],
  [
    'A Collection of Beatrix Potter Stories',
    'se! HE has wriggled out and run away; and he is dancing a jig on the top of the cupboard! ONCE upon a time there was a frog called Mr. Jeremy Fisher; he lived in a little damp house amongst',
  ],
  [
    'English Fairy Tales',
    ' how to build nests again. And that is why different birds build their nests differently. Once upon a time there was a king and a queen, as in many lands have been. The king had a daughter,',
  ],
  [
    'The Book of Stories for the Story-teller (③)',
    'tle gnome run. "He will play no tricks on me!" said he. And he went in and shut the door. Once upon a time there stood by the roadside an old red house. In this house lived three people. The',
  ],
  [
    'Stories to Read or Tell from Fairy Tales and Folklore (①)',
    'nning of the immortal King Koshchey, and about the wisdom of his daughter, Princess Mary. Once upon a time there lived King Berendey, called Longbeard, for his beard reached far below his kn',
  ],
  [
    "Laboulaye's Fairy Book (②)",
    'e learned from them where to look for the Castle of Life and the Fountain of Immortality. Once upon a time there were two brothers, who lived together in one family. One did everything, whil',
  ],
  [
    'Stories to Read or Tell from Fairy Tales and Folklore (②)',
    'other people, he was happy at last, and heard the voice of the mountain spirit no longer. Once upon a time there lived a king who had but one son, and he was called the Kindhearted. When the',
  ],
  [
    "Grimm's Fairy Tales (②)",
    's long as the shoemaker lived all went well with him, and all his undertakings prospered. There was once a man who had three sons, and nothing else in the world but the house in which he liv',
  ],
]

/** 경계가 아닌 자리 — 걸리면 안 된다. 여섯은 **규칙이 제외해야** 하는 것들이다. */
const NOT_CROSSED: Array<[string, string]> = [
  [
    '따옴표 뒤 — 인물이 들려주는 액자 이야기',
    'have promised anything. So Honker told the story, and here it is just as Peter heard it. "Once upon a time long, long, long ago, the first Wolverine was sent out to find a place for himself',
  ],
  [
    '따옴표 뒤 (②)',
    'his mouth to ask why, but remembered in time and closed it again without making a sound. "Once upon a time, long, long ago, when the world was young, lived old Mr. Snake, the grandfather a t',
  ],
  [
    '액자를 여는 말 뒤 — "this is the tale:"',
    'night that moves the old man to tell a tale of youth and adventure. And this is the tale: There were once two brothers who loved one maiden, and it appeared that the younger brother was the',
  ],
  [
    '액자를 여는 말 뒤 — "I read it in a book."',
    'id Eyebright, always ready to take the lead. "It\'s a splendid story. I read it in a book. Once upon a time, long, long ago, there was a little tailor, who was very good, and his name was Han',
  ],
  [
    '문장 한복판 — "all at once there was"',
    'inging her almost about. Then he ran out past the island, headed for the fog bank. All at once there was a strange sound, a roaring swish of water. Not one of them was certain which directio',
  ],
  [
    '문장 한복판 — "had once upon a time been"',
    'will need no special introduction. For the benefit of others let me explain that Dave had once upon a time been a homeless child, having been found wandering along the railroad tracks near C',
  ],
  [
    '문장 한복판 — "the once upon a times"',
    ' all the hours meet--the place where all the yesterdays live and the yesteryears, and the once upon a times, and the spirits of all the clocks that have run down for good. The moon begins to',
  ],
  [
    '문장 한복판 — "lost in the once upon a time"',
    'with a sword in his hand. This was a morning of adventure, to be sure,--Peter lost in the once upon a time, way, way back in the long, long ago. He climbed up to the road again and for a mom',
  ],
  [
    '따옴표 뒤 — 에스키모 아버지가 들려주는 이야기',
    'e story which the Eskimo father tells to his little ones "in their funny furry clothes." "Long, long ago in a tiny Eskimo village, there lived a strange-looking old woman. Her neck was so sh',
  ],
]

describe('storySeam', () => {
  it.each(CROSSED)('경계를 잡는다 — %s', (_title, seam) => {
    const hit = storySeam(pad(seam))
    expect(hit).not.toBeNull()
    // 근거를 돌려준다 — 숫자만 남기면 다음 사람이 눈으로 가릴 수 없다.
    expect(hit!.length).toBeGreaterThan(20)
    expect(seam).toContain(hit!.slice(0, 20))
  })

  it.each(NOT_CROSSED)('경계가 아닌 것은 넘긴다 — %s', (_why, seam) => {
    expect(storySeam(pad(seam))).toBeNull()
  })

  // ── 규칙이 스스로를 무력화하지 않는지 ─────────────────────────────
  it('글머리의 정형구는 경계가 아니다 — 그것은 이야기의 시작이다', () => {
    expect(storySeam('Once upon a time there was a king who had three daughters. ' + 'x'.repeat(400))).toBeNull()
  })

  it('150자 문턱을 넘긴 같은 문장은 잡는다 — 문턱이 실제로 문턱으로 쓰인다', () => {
    const tail = 'Once upon a time there was a king who had three daughters, and each was fairer than the last.'
    expect(storySeam(tail)).toBeNull()
    expect(storySeam('y'.repeat(160) + '. ' + tail)).not.toBeNull()
  })

  it('정형구가 아예 없으면 null — 본 사례의 한계를 시험이 기억한다', () => {
    // 실물 결함(Ivan → Oeyvind)은 뒤 이야기가 "Oeyvind was his name." 로 시작한다.
    // **이 함수는 그것을 못 잡는다.** 못 잡는다는 사실을 시험에 박아 둔다 —
    // 나중에 「이 규칙이 경계를 다 본다」고 읽는 것을 막는다.
    const real =
      'Then Ivan went into the house of Koshchei, took Vasilisa, and returned home. ' +
      'After that they lived together for a long, long time, and were very, very happy. ' +
      'Oeyvind was his name. A low, barren cliff overhung the house in which he was born; ' +
      'fir and birch looked down on the roof, and wild cherry strewed flowers over it.'
    expect(storySeam(real)).toBeNull()
  })

  it('빈 글·짧은 글에 터지지 않는다', () => {
    expect(storySeam('')).toBeNull()
    expect(storySeam('Once upon a time.')).toBeNull()
  })
})
