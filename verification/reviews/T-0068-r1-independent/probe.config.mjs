// verification/reviews/T-0068-r1-independent/probe.config.mjs
export default {
 root:'D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0068-r1-independent',
 resolve:{alias:{'@':'D:/workspace/Vocaflow-final-product/apps/web/src'}},
 test:{include:['probe.test.ts'],environment:'node',globals:false}
}
