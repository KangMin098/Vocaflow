const w = window as unknown as { __nav: string[] }
w.__nav = w.__nav ?? []
export const useRouter = () => ({ refresh() {}, push(u: string) { w.__nav.push(u) }, replace(u: string) { w.__nav.push(u) } })
export const usePathname = () => location.pathname
export const useSearchParams = () => new URLSearchParams(location.search)
export const redirect = () => { throw new Error('redirect') }
