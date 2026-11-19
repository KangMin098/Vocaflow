// apps/web/scripts/judgment-harness/build.mjs
// 판단 도구 격리 하네스 번들 — 사례 하나(cases/<slug>.tsx)를 esbuild 로 묶는다. 로그인 · 제품 라우트 · DB 없음.
// node scripts/judgment-harness/build.mjs <slug>   →  scripts/judgment-harness/out/<slug>.js(+ .css)
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const web = path.resolve(here, '../..')
const require = createRequire(path.join(web, 'package.json'))

export async function build(slug) {
  const esbuild = require(require.resolve('esbuild', { paths: [web, path.resolve(web, '../../node_modules/.pnpm/esbuild@0.28.1/node_modules')] }))
  const out = path.join(here, 'out', `${slug}.js`)
  await esbuild.build({
    entryPoints: [path.join(here, 'cases', `${slug}.tsx`)],
    bundle: true,
    outfile: out,
    format: 'esm',
    splitting: false,
    jsx: 'automatic',
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"development"' },
    nodePaths: [path.join(web, 'node_modules')],
    loader: { '.module.css': 'local-css', '.css': 'css', '.json': 'json' },
    plugins: [
      {
        name: 'alias',
        setup(b) {
          b.onResolve({ filter: /^@\// }, async (a) => {
            const r = await b.resolve('./' + a.path.slice(2), { resolveDir: path.join(web, 'src'), kind: a.kind })
            return { path: r.path, errors: r.errors }
          })
        },
      },
    ],
  })
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const slug = process.argv[2]
  if (!slug) throw new Error('slug 가 필요하다')
  console.log('built', await build(slug))
}
