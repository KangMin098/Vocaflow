// 하네스 번들 — node build.mjs <worktree apps/web> <out.js>
import path from 'node:path'
import { createRequire } from 'node:module'

const [web, out] = process.argv.slice(2)
const require = createRequire(path.join(web, 'package.json'))
const esbuild = require(process.env.ESBUILD_PATH ?? 'esbuild')
const here = path.dirname((await import('node:url')).fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: [path.join(here, 'entry.tsx')],
  bundle: true,
  outfile: out,
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  nodePaths: [path.join(web, 'node_modules')],
  loader: { '.css': 'empty' },
  plugins: [
    {
      name: 'alias',
      setup(b) {
        b.onResolve({ filter: /^@\/lib\/analytics\/client$/ }, () => ({ path: path.join(here, 'analytics-stub.ts') }))
        b.onResolve({ filter: /^@\// }, async (a) => {
          const r = await b.resolve('./' + a.path.slice(2), { resolveDir: path.join(web, 'src'), kind: a.kind })
          return { path: r.path }
        })
      },
    },
  ],
})
console.log('built', out)
