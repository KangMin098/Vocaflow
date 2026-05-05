# Dictation 모듈 - 사용자 답변 반영 사양 (확정판)

> DICTATION_MASTER.md 와 함께 사용하는 **확정 사양** 문서입니다.
> 사용자 답변에 따른 명확한 기준을 정합니다.

---

## 사용자 답변 (확정)

```
Q1: 타깃 레벨   → 3가지 레벨 모두 (CEFR A1~C2 매핑)
Q2: 단위       → 문장 + 단락 + 전체 스크립트 (3단계)
Q3: 채점 방식   → 스마트 채점 (대소문자/구두점 무시) + 단어 단위 분석
```

---

## 1. CEFR 레벨 시스템 (3가지 레벨 모두 지원)

### 1-1. 레벨 매핑 (필수 구현)

```typescript
// apps/web/src/lib/dictation/cefr.ts

export interface CEFRLevel {
  code: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  korean: string;
  description: string;
  targetGroup: '초급' | '중급' | '고급';
  
  // 받아쓰기 권장 설정
  recommended: {
    unit: 'sentence' | 'paragraph' | 'whole';
    speed: number;            // 0.5 ~ 1.5
    autoRepeat: number;       // 1 ~ 5
    hintsAllowed: boolean;
    sessionCount: number;     // 5 / 10 / 20
  };
  
  // 학습 신호
  vocabRange: [number, number];     // 어휘 수
  sentenceLength: [number, number]; // 평균 문장 길이 (단어)
  examTarget: string[];              // 시험 목표
}

export const CEFR_LEVELS: CEFRLevel[] = [
  // ─── 초급 (Beginner) ───
  {
    code: 'A1',
    korean: '입문 (초보)',
    description: '아주 단순한 일상 표현. 한 줄 1회 듣고 받아쓰기',
    targetGroup: '초급',
    recommended: {
      unit: 'sentence',
      speed: 0.75,            // 천천히
      autoRepeat: 3,          // 3회 자동 반복
      hintsAllowed: true,
      sessionCount: 5,        // 짧게 시작
    },
    vocabRange: [0, 500],
    sentenceLength: [3, 8],
    examTarget: ['Cambridge Pre-A1 (Starters)', 'TOEIC 120-225'],
  },
  {
    code: 'A2',
    korean: '기초',
    description: '간단한 일상 + 자기 소개. 짧은 문장 2-3회 듣기',
    targetGroup: '초급',
    recommended: {
      unit: 'sentence',
      speed: 0.85,
      autoRepeat: 3,
      hintsAllowed: true,
      sessionCount: 10,
    },
    vocabRange: [500, 1500],
    sentenceLength: [5, 12],
    examTarget: ['Cambridge KET', 'TOEIC 225-550', '고교 1-2학년'],
  },

  // ─── 중급 (Intermediate) ───
  {
    code: 'B1',
    korean: '중급',
    description: '익숙한 주제 의견 표현. 단락 단위 가능',
    targetGroup: '중급',
    recommended: {
      unit: 'paragraph',      // ★ 단락 시작
      speed: 1.0,             // 정상 속도
      autoRepeat: 2,
      hintsAllowed: true,
      sessionCount: 10,
    },
    vocabRange: [1500, 3500],
    sentenceLength: [10, 18],
    examTarget: ['Cambridge PET', 'TOEIC 550-785', '대학 수능'],
  },
  {
    code: 'B2',
    korean: '중상급',
    description: '복잡한 주제 + 추상 개념. 빠른 속도 가능',
    targetGroup: '중급',
    recommended: {
      unit: 'paragraph',
      speed: 1.0,
      autoRepeat: 2,
      hintsAllowed: false,    // 힌트 줄임
      sessionCount: 20,
    },
    vocabRange: [3500, 6000],
    sentenceLength: [12, 22],
    examTarget: ['Cambridge FCE', 'TOEIC 785-940', 'IELTS 5.5-6.5'],
  },

  // ─── 고급 (Advanced) ───
  {
    code: 'C1',
    korean: '고급',
    description: '쇼도잉, 축약, 구당 분석. 전체 스크립트 도전',
    targetGroup: '고급',
    recommended: {
      unit: 'whole',          // ★ 전체 스크립트
      speed: 1.0,
      autoRepeat: 1,
      hintsAllowed: false,
      sessionCount: 20,
    },
    vocabRange: [6000, 10000],
    sentenceLength: [15, 30],
    examTarget: ['Cambridge CAE', 'TOEIC 940-990', 'IELTS 7.0-7.5', '통역 시험'],
  },
  {
    code: 'C2',
    korean: '최고급 (네이티브 가까움)',
    description: '학술/전문 분야. 빠른 속도 + 미세한 발음 차이',
    targetGroup: '고급',
    recommended: {
      unit: 'whole',
      speed: 1.25,            // 빠른 속도
      autoRepeat: 1,
      hintsAllowed: false,
      sessionCount: 20,
    },
    vocabRange: [10000, 20000],
    sentenceLength: [18, 35],
    examTarget: ['Cambridge CPE', 'IELTS 8.0+', '통번역 대학원'],
  },
];

// 그룹별 분류
export function getLevelsByGroup(group: '초급' | '중급' | '고급'): CEFRLevel[] {
  return CEFR_LEVELS.filter(l => l.targetGroup === group);
}

// 자동 레벨 감지 (텍스트 분석)
export function detectLevel(text: string): CEFRLevel {
  const words = text.split(/\s+/);
  const avgSentenceLength = calculateAverageSentenceLength(text);
  const uniqueWordCount = new Set(words.map(w => w.toLowerCase())).size;
  
  // CEFR 기준 매칭
  for (const level of CEFR_LEVELS) {
    if (
      avgSentenceLength >= level.sentenceLength[0] &&
      avgSentenceLength <= level.sentenceLength[1] &&
      uniqueWordCount >= level.vocabRange[0] &&
      uniqueWordCount <= level.vocabRange[1]
    ) {
      return level;
    }
  }
  
  return CEFR_LEVELS[2]; // B1 기본값
}
```

### 1-2. SETUP 화면 - 난이도 선택 UI

```typescript
// DifficultySelector.tsx

export function DifficultySelector({ value, onChange, autoDetected }) {
  return (
    <div className="difficulty-selector">
      <h3>난이도 선택</h3>
      
      {/* 자동 감지 결과 표시 */}
      {autoDetected && (
        <div className="auto-detected">
          <span className="badge badge-info">자동 감지</span>
          이 자료는 <strong>{autoDetected.code} ({autoDetected.korean})</strong> 수준입니다
        </div>
      )}
      
      {/* 그룹별 그룹화 */}
      <div className="level-groups">
        {/* 초급 */}
        <div className="level-group">
          <h4>초급 (Beginner)</h4>
          <div className="level-cards">
            {getLevelsByGroup('초급').map(level => (
              <LevelCard
                key={level.code}
                level={level}
                selected={value === level.code}
                onClick={() => onChange(level.code)}
              />
            ))}
          </div>
        </div>

        {/* 중급 */}
        <div className="level-group">
          <h4>중급 (Intermediate)</h4>
          <div className="level-cards">
            {getLevelsByGroup('중급').map(level => (
              <LevelCard ... />
            ))}
          </div>
        </div>

        {/* 고급 */}
        <div className="level-group">
          <h4>고급 (Advanced)</h4>
          <div className="level-cards">
            {getLevelsByGroup('고급').map(level => (
              <LevelCard ... />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LevelCard({ level, selected, onClick }) {
  return (
    <button
      className={`level-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="level-code">{level.code}</div>
      <div className="level-name">{level.korean}</div>
      <div className="level-description">{level.description}</div>
      <div className="level-recommendation">
        추천: {level.recommended.unit === 'sentence' ? '문장' : 
              level.recommended.unit === 'paragraph' ? '단락' : '전체'}
        · {level.recommended.speed}x 속도
        · {level.recommended.autoRepeat}회 반복
      </div>
      <div className="level-exam">{level.examTarget[0]}</div>
    </button>
  );
}
```

---

## 2. 받아쓰기 단위 (3단계 시스템)

### 2-1. 단위별 정의

```typescript
// apps/web/src/lib/dictation/units.ts

export type DictationUnit = 'sentence' | 'paragraph' | 'whole';

export const UNIT_CONFIGS: Record<DictationUnit, UnitConfig> = {
  // ─── 문장 단위 ───
  sentence: {
    label: '문장 단위',
    labelEn: 'Sentence',
    description: '한 문장씩 받아쓰기',
    longDescription: '문장 끝(.!?)으로 분리. 가장 작은 단위로 인지 부담 최소.',
    icon: '📄',
    
    cognitiveLoad: 'low',
    workingMemoryDemand: 'low',
    recommendedFor: ['A1', 'A2', 'B1'],
    targetGroup: '초급 + 중급',
    
    audioSegment: {
      // 문장 단위 시간 추출
      method: 'sentence-boundary',
      pauseDetection: true,
      maxDuration: 15,  // 15초 이상 자르기
    },
    
    examples: [
      'The weather is nice today.',
      'I went to the library yesterday.',
    ],
  },

  // ─── 단락 단위 ───
  paragraph: {
    label: '단락 단위',
    labelEn: 'Paragraph',
    description: '단락 전체 받아쓰기',
    longDescription: '여러 문장의 단락 단위. 맥락 + 흐름 유지.',
    icon: '📃',
    
    cognitiveLoad: 'medium',
    workingMemoryDemand: 'medium',
    recommendedFor: ['B1', 'B2'],
    targetGroup: '중급',
    
    audioSegment: {
      method: 'paragraph-boundary',
      pauseDetection: true,
      maxDuration: 60,  // 1분 이상 자르기
    },
    
    examples: [
      'Climate change is one of the most pressing issues facing humanity. Scientists worldwide have warned about its consequences for decades. We must act now to prevent further damage.',
    ],
  },

  // ─── 전체 스크립트 단위 ───
  whole: {
    label: '전체 스크립트',
    labelEn: 'Whole Script',
    description: '전체 텍스트 받아쓰기',
    longDescription: '리스닝 시험처럼 전체 받아쓰기. 메모 + 재구성 가능 (Dictogloss).',
    icon: '📜',
    
    cognitiveLoad: 'high',
    workingMemoryDemand: 'high',
    recommendedFor: ['B2', 'C1', 'C2'],
    targetGroup: '고급',
    
    audioSegment: {
      method: 'whole-track',
      pauseDetection: false,
      maxDuration: 600,  // 10분
    },
    
    examples: [
      'Full TED talk transcript or news article',
    ],
    
    // 전체 모드 전용 옵션
    wholeMode: {
      allowMemoMode: true,        // 메모 모드 (Dictogloss)
      memoFirst: true,            // 먼저 듣고 메모
      reconstruct: true,           // 그 다음 재구성
      maxListenCount: 3,          // 최대 3회 듣기
    },
  },
};
```

### 2-2. SETUP - 단위 선택 UI

```typescript
// UnitSelector.tsx

export function UnitSelector({ value, onChange, level }) {
  // 레벨에 맞는 추천 단위
  const recommended = CEFR_LEVELS.find(l => l.code === level)?.recommended.unit;
  
  return (
    <div className="unit-selector">
      <h3>받아쓰기 단위</h3>
      
      <div className="unit-cards">
        {(['sentence', 'paragraph', 'whole'] as const).map(unit => {
          const config = UNIT_CONFIGS[unit];
          const isRecommended = unit === recommended;
          
          return (
            <button
              key={unit}
              className={`unit-card ${value === unit ? 'selected' : ''}`}
              onClick={() => onChange(unit)}
              aria-pressed={value === unit}
            >
              <div className="unit-icon">{config.icon}</div>
              <div className="unit-label">
                {config.label}
                {isRecommended && (
                  <span className="badge badge-recommended">추천</span>
                )}
              </div>
              <div className="unit-description">{config.description}</div>
              <div className="unit-meta">
                <span className="cognitive-load">
                  인지 부담: {
                    config.cognitiveLoad === 'low' ? '낮음' :
                    config.cognitiveLoad === 'medium' ? '중간' : '높음'
                  }
                </span>
                <span className="target-group">{config.targetGroup}</span>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* 전체 모드 선택 시 추가 옵션 */}
      {value === 'whole' && (
        <WholeModeOptions onChange={...} />
      )}
    </div>
  );
}

// 전체 모드 추가 옵션 (Dictogloss)
function WholeModeOptions({ onChange }) {
  return (
    <div className="whole-mode-options">
      <h4>전체 모드 옵션</h4>
      
      <Toggle
        label="메모 모드 (Dictogloss)"
        description="먼저 1-2회 듣고 핵심 단어 메모 → 재구성"
        helpText="고급 학습자에게 추천 (Wajnryb 1990 기반)"
      />
      
      <Slider
        label="최대 듣기 횟수"
        min={1}
        max={5}
        defaultValue={3}
      />
    </div>
  );
}
```

### 2-3. 텍스트 분리 알고리즘 (필수 구현)

```typescript
// apps/web/src/lib/dictation/text-splitter.ts

export function splitText(text: string, unit: DictationUnit): string[] {
  switch (unit) {
    case 'sentence':
      return splitSentences(text);
    
    case 'paragraph':
      return splitParagraphs(text);
    
    case 'whole':
      return [text];  // 전체 그대로
  }
}

function splitSentences(text: string): string[] {
  // 정규식 + 약어 처리
  // "Mr. Smith said, 'Hello!'" 같은 케이스 처리
  
  const ABBREVIATIONS = ['Mr.', 'Mrs.', 'Dr.', 'Ms.', 'Prof.', 'Inc.', 'Ltd.', 'St.', 'vs.', 'etc.'];
  
  // 약어 임시 치환
  let processed = text;
  ABBREVIATIONS.forEach(abbr => {
    processed = processed.replace(
      new RegExp(abbr.replace(/\./g, '\\.'), 'g'),
      abbr.replace('.', '<<DOT>>')
    );
  });
  
  // 문장 분리 (.!? 다음 공백 + 대문자)
  const sentences = processed
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.replace(/<<DOT>>/g, '.').trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

function splitParagraphs(text: string): string[] {
  // 빈 줄로 분리
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// 단어 수 + 시간 추정
export function estimateUnit(text: string): {
  wordCount: number;
  estimatedSeconds: number;
} {
  const words = text.split(/\s+/).length;
  // 평균 발화 속도: 150 wpm (분당 단어)
  const estimatedSeconds = (words / 150) * 60;
  
  return { wordCount: words, estimatedSeconds };
}
```

---

## 3. 채점 방식 (스마트 채점 = 기본값)

### 3-1. 핵심 결정

```
✅ 기본 채점 모드: 스마트 (대소문자 + 구두점 무시)
✅ 옵션: 엄격 모드 (시험 준비용)
✅ 단어 단위 분석 항상 활성 (오답 패턴 학습용)
```

### 3-2. 스마트 채점 상세 사양

```typescript
// apps/web/src/lib/dictation/scoring.ts

export const SCORING_PRESETS = {
  smart: {
    label: '스마트',
    isDefault: true,
    description: '대소문자, 구두점 무시. 단어 의미만 평가.',
    
    rules: {
      // 무시할 것
      ignoreCase: true,
      ignorePunctuation: true,
      ignoreLeadingTrailingWhitespace: true,
      ignoreMultipleSpaces: true,
      
      // 허용할 것
      allowContractions: true,        // "don't" = "do not"
      allowAbbreviations: true,       // "Mr." = "Mister"
      allowNumbers: true,             // "5" = "five"
      
      // 채점할 것
      checkSpelling: true,            // 스펠링은 체크
      checkWordOrder: true,           // 어순은 체크
      checkMissingWords: true,        // 누락 체크
      
      // 부분 점수
      misspelledThreshold: 0.8,       // 80% 유사도 → 부분 점수
      misspelledScore: 0.5,           // 부분 점수 50%
    },
  },
  
  strict: {
    label: '엄격',
    isDefault: false,
    description: '대소문자, 구두점 모두 체크. 시험 준비용.',
    
    rules: {
      ignoreCase: false,              // 대소문자 체크
      ignorePunctuation: false,       // 구두점 체크
      ignoreLeadingTrailingWhitespace: true,
      ignoreMultipleSpaces: false,    // 공백 정확히
      
      allowContractions: false,       // 정확히
      allowAbbreviations: false,
      allowNumbers: false,
      
      checkSpelling: true,
      checkWordOrder: true,
      checkMissingWords: true,
      
      misspelledThreshold: 1.0,       // 정확히 일치만
      misspelledScore: 0,
    },
  },
};
```

### 3-3. 스마트 채점 알고리즘

```typescript
export function scoreSmart(
  expected: string,
  actual: string,
  rules: ScoringRules
): ScoringResult {
  // 1. 전처리 (스마트 모드)
  let normalizedExpected = expected;
  let normalizedActual = actual;
  
  if (rules.ignoreCase) {
    normalizedExpected = normalizedExpected.toLowerCase();
    normalizedActual = normalizedActual.toLowerCase();
  }
  
  if (rules.ignorePunctuation) {
    normalizedExpected = normalizedExpected.replace(/[.,!?;:'"()\[\]]/g, '');
    normalizedActual = normalizedActual.replace(/[.,!?;:'"()\[\]]/g, '');
  }
  
  if (rules.ignoreMultipleSpaces) {
    normalizedExpected = normalizedExpected.replace(/\s+/g, ' ').trim();
    normalizedActual = normalizedActual.replace(/\s+/g, ' ').trim();
  }
  
  // 2. 축약 처리
  if (rules.allowContractions) {
    normalizedActual = expandContractions(normalizedActual);
    normalizedExpected = expandContractions(normalizedExpected);
  }
  
  // 3. 토큰화
  const expectedTokens = tokenize(normalizedExpected);
  const actualTokens = tokenize(normalizedActual);
  
  // 4. Word-level alignment (Needleman-Wunsch)
  const alignment = alignWords(expectedTokens, actualTokens);
  
  // 5. 단어별 채점
  const wordResults: WordResult[] = alignment.map(({ exp, act }) => {
    if (!exp && act) return makeExtraResult(act);
    if (exp && !act) return makeMissingResult(exp);
    
    const similarity = levenshteinSimilarity(exp!, act!);
    
    if (similarity === 1.0) return makeCorrectResult(exp!, act!);
    if (similarity >= rules.misspelledThreshold) {
      return makeMisspelledResult(exp!, act!, similarity);
    }
    return makeWrongResult(exp!, act!);
  });
  
  // 6. 점수 계산
  const totalWeight = wordResults.length;
  const weightedScore = wordResults.reduce((sum, r) => {
    if (r.status === 'correct') return sum + 1;
    if (r.status === 'misspelled') return sum + rules.misspelledScore;
    return sum;
  }, 0);
  
  const accuracy = (weightedScore / totalWeight) * 100;
  
  // 7. 오류 패턴 분석 (필수)
  const errorPatterns = analyzeErrorPatterns(wordResults);
  
  return {
    accuracy,
    wordResults,
    errorPatterns,
    feedback: generateFeedback(errorPatterns),
  };
}

// 축약 확장
function expandContractions(text: string): string {
  const contractions: Record<string, string> = {
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "won't": "will not",
    "wouldn't": "would not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "i'm": "i am",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    // ... 등
  };
  
  let result = text;
  Object.entries(contractions).forEach(([short, long]) => {
    result = result.replace(new RegExp(`\\b${short}\\b`, 'gi'), long);
  });
  return result;
}

// Levenshtein 유사도 (0~1)
function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}
```

### 3-4. 단어 단위 분석 (항상 활성)

```typescript
// apps/web/src/lib/dictation/analyzer.ts

export function analyzeErrorPatterns(wordResults: WordResult[]): ErrorPattern[] {
  const patterns: ErrorPattern[] = [];
  
  // ─── 1. 음운 오류 패턴 ───
  
  // (a) 동사 -ed 누락
  const edDropErrors = wordResults.filter(w => 
    w.expected.endsWith('ed') && 
    w.actual && 
    !w.actual.endsWith('ed') &&
    levenshteinDistance(w.expected, w.actual + 'ed') <= 1
  );
  if (edDropErrors.length > 0) {
    patterns.push({
      type: 'phonetic',
      subtype: 'past-tense-ed',
      description: '동사 과거형 -ed 발음 인식 어려움',
      examples: edDropErrors.map(e => ({ expected: e.expected, actual: e.actual })),
      frequency: edDropErrors.length,
      suggestion: '동사 끝의 -ed는 약하게 발음됩니다. 천천히 다시 들어보세요.',
      cefrLevel: ['A2', 'B1'],
    });
  }
  
  // (b) 관사/약형 누락
  const articleDropErrors = wordResults.filter(w =>
    ['a', 'an', 'the'].includes(w.expected.toLowerCase()) &&
    w.status === 'missing'
  );
  if (articleDropErrors.length > 0) {
    patterns.push({
      type: 'phonetic',
      subtype: 'article-drop',
      description: '관사 (a, an, the) 누락',
      examples: articleDropErrors.map(...),
      frequency: articleDropErrors.length,
      suggestion: '관사는 약하게 발음되어 놓치기 쉽습니다.',
      cefrLevel: ['A1', 'A2', 'B1'],
    });
  }
  
  // (c) 자음군 (plurals 등)
  const pluralDropErrors = wordResults.filter(w =>
    w.expected.endsWith('s') &&
    w.actual &&
    !w.actual.endsWith('s') &&
    levenshteinDistance(w.expected, w.actual + 's') <= 1
  );
  if (pluralDropErrors.length > 0) {
    patterns.push({
      type: 'morphological',
      subtype: 'plural-s',
      description: '복수형 -s 누락',
      examples: pluralDropErrors.map(...),
      frequency: pluralDropErrors.length,
      suggestion: '단어 끝의 -s/es 발음에 주의하세요.',
      cefrLevel: ['A1', 'A2'],
    });
  }
  
  // ─── 2. 동음이의어 혼동 ───
  
  const homophoneErrors = wordResults.filter(w =>
    isHomophone(w.expected, w.actual)
  );
  if (homophoneErrors.length > 0) {
    patterns.push({
      type: 'lexical',
      subtype: 'homophones',
      description: '동음이의어 혼동',
      examples: homophoneErrors.map(...),
      frequency: homophoneErrors.length,
      suggestion: '발음이 같지만 다른 단어입니다 (their/there/they\'re 등).',
      cefrLevel: ['B1', 'B2'],
    });
  }
  
  // ─── 3. 스펠링 패턴 ───
  
  const spellingErrors = wordResults.filter(w => w.status === 'misspelled');
  if (spellingErrors.length > 0) {
    patterns.push({
      type: 'lexical',
      subtype: 'spelling',
      description: '스펠링 오류',
      examples: spellingErrors.map(...),
      frequency: spellingErrors.length,
      suggestion: '음성을 들으면서 스펠링도 체크해보세요.',
      cefrLevel: ['A1', 'A2', 'B1', 'B2'],
    });
  }
  
  // ─── 4. 어순 ───
  
  // (생략 - 더 복잡한 NLP 필요)
  
  // 빈도순 정렬
  return patterns.sort((a, b) => b.frequency - a.frequency);
}

// 동음이의어 데이터베이스
const HOMOPHONES: Record<string, string[]> = {
  'their': ['there', "they're"],
  'there': ['their', "they're"],
  'they\'re': ['their', 'there'],
  'your': ['you\'re'],
  'you\'re': ['your'],
  'its': ["it's"],
  "it's": ['its'],
  'to': ['too', 'two'],
  'too': ['to', 'two'],
  'two': ['to', 'too'],
  'hear': ['here'],
  'here': ['hear'],
  // ... 등
};

function isHomophone(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  return HOMOPHONES[aLower]?.includes(bLower) || false;
}
```

### 3-5. RESULTS 화면 - 패턴 분석 표시

```typescript
// ErrorAnalysis.tsx

export function ErrorAnalysis({ patterns }) {
  if (patterns.length === 0) {
    return (
      <div className="error-analysis empty">
        <span>✨</span>
        <p>오류 패턴이 발견되지 않았습니다. 훌륭합니다!</p>
      </div>
    );
  }
  
  return (
    <div className="error-analysis">
      <h3>📌 보강 필요 영역</h3>
      
      {patterns.slice(0, 5).map(pattern => (
        <div key={pattern.subtype} className="pattern-card">
          <div className="pattern-header">
            <span className={`pattern-type pattern-type--${pattern.type}`}>
              {pattern.type === 'phonetic' ? '🔊 음운' :
               pattern.type === 'morphological' ? '🔠 형태' :
               pattern.type === 'syntactic' ? '🔗 구문' :
               '📚 어휘'}
            </span>
            <span className="pattern-frequency">{pattern.frequency}회</span>
          </div>
          
          <p className="pattern-description">{pattern.description}</p>
          
          {/* 예시 */}
          <div className="pattern-examples">
            {pattern.examples.slice(0, 3).map((ex, i) => (
              <div key={i} className="example">
                <span className="expected">{ex.expected}</span>
                <span className="arrow">→</span>
                <span className="actual">{ex.actual || '(누락)'}</span>
              </div>
            ))}
          </div>
          
          {/* 제안 */}
          <div className="pattern-suggestion">
            💡 {pattern.suggestion}
          </div>
          
          {/* SRS 추가 버튼 */}
          <button onClick={() => addToFlashcards(pattern.examples)}>
            Flashcard에 추가 ({pattern.examples.length}개)
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. 통합 검증 체크리스트 (확정 사양)

### 4-1. CEFR 레벨 (3가지 그룹 지원)
- [ ] 초급 (A1, A2) - 문장 단위 + 0.75x 속도 + 3회 반복 + 힌트 허용
- [ ] 중급 (B1, B2) - 단락 단위 + 1.0x 속도 + 2회 반복
- [ ] 고급 (C1, C2) - 전체 단위 + 1.0~1.25x 속도 + 1회 반복 + 힌트 X
- [ ] 자동 레벨 감지 (텍스트 분석)
- [ ] 시험 목표 표시 (TOEIC, IELTS, Cambridge)

### 4-2. 단위 (3단계)
- [ ] 문장 단위 - 정규식 + 약어 처리 (Mr., Dr. 등)
- [ ] 단락 단위 - 빈 줄 분리
- [ ] 전체 스크립트 - Dictogloss 옵션 (메모 모드)
- [ ] 텍스트 분리 알고리즘 정확
- [ ] 단어 수 + 시간 추정 표시

### 4-3. 스마트 채점 (기본값)
- [ ] 대소문자 무시
- [ ] 구두점 무시
- [ ] 다중 공백 무시
- [ ] 축약 자동 확장 ("don't" = "do not")
- [ ] 부분 점수 (80% 유사도 → 50% 점수)
- [ ] 단어 단위 색상 피드백

### 4-4. 단어 단위 분석 (항상)
- [ ] 음운 오류 (동사 -ed, 관사, 자음군)
- [ ] 형태론 오류 (복수형, 3인칭 단수, 소유격)
- [ ] 동음이의어 혼동 (their/there/they're)
- [ ] 스펠링 오류
- [ ] CEFR 레벨별 권장 사항 표시

### 4-5. 옵션 모드 - 엄격 채점
- [ ] 토글로 전환 가능
- [ ] 시험 준비용 표시
- [ ] 모든 규칙 활성화

---

## 5. 사용자 경험 흐름 (확정)

### 시나리오 1: 초급 사용자

```
1. HUB 접속
   → 자동: A2 자료 추천 (이전 정확도 78%)

2. SETUP
   → 추천: 문장 단위, 5개, 순차, 스마트 채점, A2
   → 사용자: 그대로 진행

3. SESSION
   → 0.75x 속도, 자동 3회 반복
   → 첫 글자 힌트 허용 (-5점)
   → 한국어 뜻 정답 후 표시

4. RESULTS
   → 정확도 85%
   → 패턴 분석: "복수형 -s 누락 3건"
   → 추천: "동일 자료 한 번 더"
```

### 시나리오 2: 중급 사용자

```
1. HUB 접속
   → 추천: B1 BBC News 단락

2. SETUP
   → 추천: 단락 단위, 10개, 랜덤, 스마트, B1
   → 사용자: 강격 채점으로 변경 (시험 준비)

3. SESSION
   → 1.0x 속도, 2회 반복
   → 힌트 X
   → 단락 단위 받아쓰기

4. RESULTS
   → 정확도 78%
   → 패턴 분석: "관사 누락 5건", "전치사 혼동 2건"
   → 오답 단어 8개 → Flashcard 추가
```

### 시나리오 3: 고급 사용자

```
1. HUB 접속
   → 추천: TED Talk 전체 (C1)

2. SETUP
   → 추천: 전체 모드, all, 순차, 스마트, C1
   → 사용자: Dictogloss 메모 모드 활성

3. SESSION
   → 1.0x 속도, 1회만 듣기
   → 메모 모드: 핵심 단어만 메모 → 재구성
   → 시간 측정

4. RESULTS
   → 정확도 92%
   → 패턴 분석: "동음이의어 1건"
   → 다음: C2 자료 도전 추천
```

---

## 결론

이 확정 사양으로 Claude Code가 작업하면 사용자 답변과 100% 일치하는 모듈이 만들어집니다.

핵심 차별화:
1. **CEFR 자동 레벨 감지 + 그룹별 UI** (초급/중급/고급)
2. **3단계 단위 + Dictogloss 메모 모드** (전체 스크립트)
3. **스마트 채점 기본 + 단어 단위 분석** (오답 패턴 자동 학습)
4. **레벨별 자동 추천 설정** (속도, 반복, 힌트)
5. **시험 목표 매핑** (TOEIC, IELTS, Cambridge)

`DICTATION_MASTER.md` + 이 문서 (`DICTATION_SPEC.md`) 함께 Claude Code에 전달.
