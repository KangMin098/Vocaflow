// verification/reviews/T-0063-r1-independent-probe/probe.config.mjs
export default {
  root: 'D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0063-r1-independent-probe',
  resolve: { alias: {
    '@': 'D:/workspace/Vocaflow-final-product/apps/web/src',
    'react': 'D:/workspace/Vocaflow-final-product/apps/web/node_modules/react',
    'react-dom': 'D:/workspace/Vocaflow-final-product/apps/web/node_modules/react-dom',
  } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['probe.test.tsx'], environment: 'node', globals: false },
}
