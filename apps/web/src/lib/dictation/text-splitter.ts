// apps/web/src/lib/dictation/text-splitter.ts
// 영어 텍스트를 문장으로 분리 + 문항 묶음(chunk) 구성

const ABBREVIATIONS = [
  'Mr.',
  'Mrs.',
  'Dr.',
  'Ms.',
  'Prof.',
  'Inc.',
  'Ltd.',
  'St.',
  'vs.',
  'etc.',
  'e.g.',
  'i.e.',
  'a.m.',
  'p.m.',
  'No.',
  'Jr.',
  'Sr.',
];

const ABBR_TOKEN = 'DOT';

export function splitSentences(text: string): string[] {
  let processed = text;
  // 약어의 .을 임시 토큰으로
  ABBREVIATIONS.forEach((abbr) => {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    processed = processed.replace(
      new RegExp(escaped, 'g'),
      abbr.replace(/\./g, ABBR_TOKEN)
    );
  });

  // 문장 분리: .!? 뒤 공백 + 대문자 시작
  const sentences = processed
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.replace(new RegExp(ABBR_TOKEN, 'g'), '.').trim())
    .filter((s) => s.length > 0);

  return sentences;
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

export function estimateUnit(text: string): {
  wordCount: number;
  estimatedSeconds: number;
} {
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  // 평균 발화 속도 150wpm
  const estimatedSeconds = (words / 150) * 60;
  return { wordCount: words, estimatedSeconds };
}
