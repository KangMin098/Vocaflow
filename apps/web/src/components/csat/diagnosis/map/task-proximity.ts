// apps/web/src/components/csat/diagnosis/map/task-proximity.ts
/** Distance to a card's rectangle, so its surrounding gap can preview connections too. */
export function nearestTask<T extends string>(
  point: { x: number; y: number },
  cards: { id: T; left: number; right: number; top: number; bottom: number }[],
  reach: number,
): T | null {
  let nearest: T | null = null
  let distance = Math.max(0, reach) ** 2
  for (const card of cards) {
    if (card.right <= card.left || card.bottom <= card.top) continue
    const dx = Math.max(card.left - point.x, 0, point.x - card.right)
    const dy = Math.max(card.top - point.y, 0, point.y - card.bottom)
    const squared = dx * dx + dy * dy
    if (squared <= distance && (nearest === null || squared < distance)) {
      nearest = card.id
      distance = squared
    }
  }
  return nearest
}
