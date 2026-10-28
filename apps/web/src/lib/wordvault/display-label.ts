// apps/web/src/lib/wordvault/display-label.ts
// WordVault 출처 칩의 **발행 출처 제목**을 화면 글자로 — 저장된 제목에 남은 HTML 엔티티(`Lincoln&#x27;s`)를 한 번만 푼다.
// 실측 2026-10-28: 구독 기사 단어장 제목이 `Lincoln&#x27;s Cottage: …` 로 칩에 그대로 보였다(pb-t0198-vault-1280.png).
// 규칙: 한 번만(`&amp;#x27;` → `&#x27;`, 두 번 풀지 않는다) · 아는 이름 엔티티와 숫자 엔티티만 · 잘못된 엔티티는 그대로.
// 표시용이다 — id · filter · count · URL · DB 제목은 바꾸지 않는다. React 텍스트로만 렌더한다(HTML 로 넣지 않는다).

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

export function decodeEntitiesOnce(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,6});/g, (whole, body: string) => {
    if (body[0] !== '#') return NAMED[body.toLowerCase()] ?? whole
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
    // 유효 범위 밖 · 대리 쌍 · NUL 은 그대로 둔다
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole
    return String.fromCodePoint(code)
  })
}
