// verification/reviews/NEXT-PRODUCT-CORE-20261021/probe.config.mjs
export default {
  root: 'D:/workspace/Vocaflow-AI-Control/verification/reviews/NEXT-PRODUCT-CORE-20261021',
  resolve: { alias: { '@': 'D:/workspace/Vocaflow-final-product/apps/web/src', 'server-only': 'D:/workspace/Vocaflow-final-product/apps/web/src/test/server-only-stub.ts', react: 'D:/workspace/Vocaflow-final-product/apps/web/node_modules/react' } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['probe.test.ts'], environment: 'node' },
}
