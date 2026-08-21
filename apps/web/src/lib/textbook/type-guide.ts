// apps/web/src/lib/textbook/type-guide.ts
//
// 문항 유형의 **학습자용 이름과 설명** — 단일 출처.
//
// 왜 모아 두나: 이 이름이 서가·상세·(앞으로) My Library 세 곳에 나온다. 화면마다 적으면
// 반드시 갈린다 — 이 저장소가 이름 레지스트리를 만든 이유가 그것이다(apps/web/CLAUDE.md).
//
// `says` 는 **그 유형이 학습자에게 무엇을 시키는지**를 말한다. 유형 코드를 한국어로 옮기기만
// 하면(예: insert → '문장 삽입') 고르는 데 도움이 안 된다. 서점 교재의 구성란이 하는 일은
// "이 코너가 무슨 능력을 요구하는가" 를 알려 주는 것이다.

export interface TypeGuide {
  label: string
  says: string
}

export const TYPE_GUIDE: Record<string, TypeGuide> = {
  rhyme: {
    label: '소리·운율',
    says: '같은 소리로 끝나는 낱말을 찾아요. 읽기 전 단계의 소리 감각을 잡습니다.',
  },
  word_meaning: {
    label: '낱말 뜻',
    says: '낱말과 뜻을 잇습니다. 지문이 없어 처음 배우는 학년도 바로 할 수 있어요.',
  },
  spell_blank: {
    label: '철자 완성',
    says: '빠진 철자를 채웁니다. 눈으로 아는 낱말을 손으로도 쓸 수 있게 만듭니다.',
  },
  word_order: {
    label: '영작 배열',
    says: '흩어진 낱말을 문장으로 세웁니다. 정답이 원문이라 헷갈릴 여지가 없어요.',
  },
  vocab_choice: {
    label: '어휘 추론',
    says: '글 안에서 어울리지 않는 낱말을 찾습니다. 뜻을 외운 것만으로는 풀리지 않아요.',
  },
  grammar_choice: {
    label: '어법',
    says: '문장에서 어법이 틀린 곳을 고릅니다. 중등 내신의 서술형과 같은 축입니다.',
  },
  order: {
    label: '글 순서',
    says: '토막 난 글을 원래 순서로 되돌립니다. 문장 사이의 연결을 봐야 풀려요.',
  },
  insert: {
    label: '문장 삽입',
    says: '빠진 문장이 들어갈 자리를 찾습니다. 앞뒤 흐름을 동시에 봐야 합니다.',
  },
  irrelevant: {
    label: '흐름 무관',
    says: '글 전체의 논지에서 벗어난 문장을 찾습니다. 부분이 아니라 전체를 봐야 하는 첫 유형이에요.',
  },
}
