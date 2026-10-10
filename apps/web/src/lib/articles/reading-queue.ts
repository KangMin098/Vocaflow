// apps/web/src/lib/articles/reading-queue.ts
// apps/web/src/lib/articles/reading-queue.ts
export const isReadingAdaptationSourceId = (sourceId: unknown): boolean =>
  typeof sourceId === 'string' && sourceId.startsWith('reading:')
