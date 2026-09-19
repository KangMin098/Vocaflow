// apps/web/src/lib/worksheet/__tests__/qr.test.ts
//
// **인쇄해서 나눠 준 뒤에야 못 읽는 QR 이었음을 아는 것**을 막는다.
//
// QR 은 모듈 크기가 전부다. 긴 주소를 담으면 모듈 수가 늘고, 같은 지면에서 각 모듈이
// 작아진다. 화면에서는 멀쩡해 보인다 — **종이에서만 실패한다.**
// 실측: `/fit/s/<payload>` 는 434자 → 81×81 → 30mm 에서 0.37mm/모듈(복사본에서 불가).
//       `/join/ABC123` 은 32자 → 29×29 → 30mm 에서 1.03mm/모듈.

import { describe, expect, it } from 'vitest'

import { MAX_QR_URL_LENGTH, printSizeMm, qrSvg } from '../qr'

describe('인쇄용 QR', () => {
  it('학급 초대 주소는 성기게 나온다 — 복사본에서도 읽혀야 한다', () => {
    const q = qrSvg('https://vocaflow.app/join/ABC123')
    expect(q).not.toBeNull()
    // 모듈이 40을 넘으면 30mm 인쇄에서 0.75mm/모듈 아래로 떨어진다.
    expect(q?.modules ?? 999).toBeLessThanOrEqual(40)
    expect(q?.markup).toContain('<svg')
  })

  it('너무 긴 주소는 거부한다 — 조용히 촘촘한 QR 을 내보내지 않는다', () => {
    // `/fit/s/<payload>` 급 길이. 만들어 주면 교사는 나눠 준 뒤에 안다.
    expect(qrSvg('https://vocaflow.app/fit/s/' + 'A'.repeat(400))).toBeNull()
    expect(MAX_QR_URL_LENGTH).toBeLessThan(200)
  })

  it('빈 주소에는 아무것도 만들지 않는다', () => {
    expect(qrSvg('')).toBeNull()
    expect(qrSvg('   ')).toBeNull()
  })

  it('인쇄 크기는 모듈당 0.5mm 를 지키되 지면을 잡아먹지 않는다', () => {
    expect(printSizeMm(29)).toBeGreaterThanOrEqual(22)
    expect(printSizeMm(29)).toBeLessThanOrEqual(34)
    // 모듈이 많아지면 커지지만 상한에서 멈춘다.
    expect(printSizeMm(81)).toBe(34)
  })
})
