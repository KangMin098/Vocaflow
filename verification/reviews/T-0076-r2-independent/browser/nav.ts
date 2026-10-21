export const useRouter = () => ({ refresh: () => (window as unknown as { __refresh?: () => void }).__refresh?.(), push() {}, replace() {} })
export const usePathname = () => '/csat/diagnosis'
export const useSearchParams = () => new URLSearchParams()
