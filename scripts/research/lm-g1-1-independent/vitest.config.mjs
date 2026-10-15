// scripts/research/lm-g1-1-independent/vitest.config.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const req=createRequire((process.env.VF_REVIEW_DEP_ROOT??root)+'/apps/web/package.json');
export default {root,esbuild:{jsx:'automatic'},resolve:{alias:{'@':root+'/apps/web/src','@vocaflow/library-pipeline/textbook-series':root+'/packages/library-pipeline/src/textbook/series.ts','vitest':req.resolve('vitest').replace(/index\.cjs$/,'dist/index.js'),'react/jsx-dev-runtime':req.resolve('react/jsx-dev-runtime'),'react/jsx-runtime':req.resolve('react/jsx-runtime'),'react-dom/server':req.resolve('react-dom/server'),'react':req.resolve('react'),'next/link':req.resolve('next/link'),'lucide-react':req.resolve('lucide-react'),'ajv/dist/2020':req.resolve('ajv/dist/2020')}},test:{environment:'node',pool:'forks',poolOptions:{forks:{singleFork:true}},include:['scripts/research/lm-g1-1-independent/*.test.ts']}};
