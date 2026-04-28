// packages/types/src/game.ts
// 게임 모듈 타입 — Flashcard / SpellForge / WordBlitz / ScriptQuiz.

export type GameModule = 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz';

export type FlashcardMode = 'word' | 'meaning';
export type GameScreen = 'start' | 'game' | 'result';

export type QuizState = 'start' | 'question' | 'feedback' | 'result';
export type QuizAnswerState = 'idle' | 'selected' | 'answered';

export interface QuizQuestion {
  id: string;
  type: 'multiple' | 'truefalse' | 'blank';
  question: string;
  options: { text: string }[];
  correctIndex: number;
  sourceSnippet: string;
  sourceSentenceIdx: number;
}
