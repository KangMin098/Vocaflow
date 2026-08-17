// apps/web/src/lib/seo/site.ts
//
// 사이트 기준 URL 한 곳 — canonical · OG · sitemap · robots 가 전부 여기서 파생된다.
//
// 왜 상수가 필요한가 (2026-08-17 실측):
//   루트 layout 에 `metadataBase` 가 **없었다**. Next 는 그 경우 OG·canonical URL 을 상대경로로
//   내보내고, 상대 OG URL 은 대부분의 메신저·SNS 미리보기에서 **무시된다.**
//   즉 공유 링크(`/fit?r=`)에 제목·설명을 붙여 놨어도 상당수 플랫폼에서 안 보이는 상태였다.
//   공유가 이 제품의 유일한 확산 경로라, 이건 SEO 항목이 아니라 기능 결함에 가깝다.
//
// 값의 출처 순서:
//   1) `NEXT_PUBLIC_SITE_URL` — 배포 환경에서 명시 (프리뷰 배포마다 다르다)
//   2) `VERCEL_URL` — 프리뷰 자동 주입 (프로토콜이 없어 붙여 준다)
//   3) 프로덕션 도메인 — 마지막 폴백
//
// ⚠️ 로컬(`localhost`)을 폴백으로 두지 않는다 — 실수로 배포되면 모든 canonical 이
//    localhost 를 가리켜 색인이 통째로 망가진다. 잘못된 절대 URL 보다 프로덕션 도메인이 안전하다.

/** 프로덕션 도메인 — robots.txt 가 이미 이 값을 sitemap 위치로 광고하고 있다. */
const PRODUCTION_ORIGIN = 'https://vocaflow.app'

function resolveOrigin(): string {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL']?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercel = process.env['VERCEL_URL']?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`

  return PRODUCTION_ORIGIN
}

/** 사이트 기준 origin (뒤 슬래시 없음). */
export const SITE_ORIGIN = resolveOrigin()

/** `metadataBase` 용 URL 객체. */
export const SITE_URL = new URL(SITE_ORIGIN)

/** 절대 URL 을 만든다. 경로는 '/' 로 시작해야 한다. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
