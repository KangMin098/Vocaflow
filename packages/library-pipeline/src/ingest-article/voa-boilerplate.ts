// packages/library-pipeline/src/ingest-article/voa-boilerplate.ts
/** Exact observed VOA site instructions only. Unknown paragraphs are preserved. */
export function stripVoaBoilerplate(text: string): string {
  const exact = [
    /^Download the document below for a lesson plan, video text, and learning activities\.$/i,
    /^(?:What do you think of this lesson\? We want to hear from you\. )?We have a new comment system\. Here is how it works:$/i,
    /^1\.\s*Write your comment in the box\.$/i,
    /^2\.\s*Under the box, you can see four images for social media accounts\. They are for Disqus, Facebook, Twitter and Google\.$/i,
    /^3\.\s*Click on one image and a box appears\. Enter the login for your social media account\. Or you may create one on the Disqus system\. It is the blue circle with [“"]D[”"] on it\. It is free\.$/i,
    /^Each time you return to comment on the Learning English site, you can use your account and see your comments and replies to them\.(?: Our comment policy is here\.)?$/i,
  ]
  return text.split(/\r?\n/).filter(line => !exact.some(re => re.test(line.trim()))).join('\n').trim()
}
