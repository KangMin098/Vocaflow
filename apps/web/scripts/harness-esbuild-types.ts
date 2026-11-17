// apps/web/scripts/harness-esbuild-types.ts
// The isolated harnesses load Vite's installed esbuild at runtime. Describe the
// consumed boundary without importing a transitive package as a direct dependency.
interface ResolveArgs { path: string; kind: string }
interface ResolveResult { path?: string; namespace?: string }
interface LoadResult { contents?: string | Uint8Array; loader?: string; resolveDir?: string }
interface HarnessBuildContext {
  onResolve(options: { filter: RegExp; namespace?: string }, callback: (args: ResolveArgs) => ResolveResult | Promise<ResolveResult>): void
  onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string }) => LoadResult | Promise<LoadResult>): void
  resolve(path: string, options: { kind: string; resolveDir: string }): Promise<ResolveResult>
}
interface HarnessBuildOptions {
  plugins?: { name: string; setup(build: HarnessBuildContext): void }[]
  [option: string]: unknown
}
export interface HarnessEsbuildApi {
  build(options: HarnessBuildOptions): Promise<{
    outputFiles: { path: string; text: string }[]
    metafile?: { inputs: Record<string, unknown> }
  }>
}
