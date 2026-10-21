// scripts/design/lib/read-only-context.mjs
/** Browser write guard plus known server-GET writers. Never assume every GET is read-only. */
export async function blockLearningWrites(context, blocked = []) {
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (['GET', 'HEAD'].includes(request.method()) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      const privateText = /^\/text\/[^/]+/.test(url.pathname) && url.pathname !== '/text/new'
      const articleOrJoin = /^\/library\/scripts\/[^/]+/.test(url.pathname) || url.pathname.startsWith('/join/')
      const cookies = articleOrJoin && context.cookies ? await context.cookies(url.origin) : []
      const authenticatedWriter = articleOrJoin && (!context.cookies || cookies.some(cookie => /auth-token(?:\.\d+)?$/.test(cookie.name)))
      if (privateText || url.pathname === '/teacher' || authenticatedWriter) {
        blocked.push(`SERVER_GET ${request.method()} ${url.pathname.slice(0, 80)}`)
        return route.abort('blockedbyclient')
      }
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || url.pathname.startsWith('/auth/v1/')) {
      return route.continue()
    }
    blocked.push(`${request.method()} ${url.pathname.slice(0, 80)}`)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}
