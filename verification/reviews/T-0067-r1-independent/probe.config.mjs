// verification/reviews/T-0067-r1-independent/probe.config.mjs
export default {
 root:'D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0067-r1-independent',
 resolve:{alias:{'@':'D:/workspace/Vocaflow-final-product/apps/web/src','react':'D:/workspace/Vocaflow-final-product/apps/web/node_modules/react','react-dom':'D:/workspace/Vocaflow-final-product/apps/web/node_modules/react-dom','next':'D:/workspace/Vocaflow-final-product/apps/web/node_modules/next'}},
 esbuild:{jsx:'automatic'},test:{include:['probe.test.ts'],environment:'node',globals:false}
}
