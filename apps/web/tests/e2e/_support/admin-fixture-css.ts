// apps/web/tests/e2e/_support/admin-fixture-css.ts
// Compile the actual app CSS without requiring a previous private Next build.
import path from 'node:path'
import { createRequire } from 'node:module'

export async function adminFixtureCss(web: string): Promise<string> {
  const requireTool = createRequire(path.join(web, 'package.json'))
  const { build } = requireTool(requireTool.resolve('esbuild', {
    paths: [path.resolve(web, '../../node_modules/.pnpm/node_modules')],
  }))
  const entry = path.join(web, 'src/app/globals.css')
  const bundled = await build({ entryPoints: [entry], bundle: true, write: false, logLevel: 'silent' })
  const loadConfig = requireTool('tailwindcss/loadConfig')
  const config = loadConfig(path.join(web, 'tailwind.config.ts'))
  const css = await requireTool('postcss')([
    requireTool('tailwindcss')({ ...config, content: [path.join(web, 'src/**/*.{js,ts,jsx,tsx,mdx}')] }),
  ]).process(bundled.outputFiles[0].text, { from: entry, map: false })
  return css.css
}
