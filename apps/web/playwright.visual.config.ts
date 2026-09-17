// apps/web/playwright.visual.config.ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
]

export default defineConfig({
  ...base,
  testDir: './tests/visual',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results/design-qa',
  snapshotPathTemplate: '{testDir}/../../test-results-csat-learner/design-baselines/{platform}/{projectName}/{testFilePath}/{arg}{ext}',
  // Missing baselines must fail comparison; creation is an explicit CLI action.
  updateSnapshots: 'none',
  timeout: 90_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/design-qa', open: 'never' }],
    ['json', { outputFile: 'playwright-report/design-qa/results.json' }],
  ],
  use: {
    ...base.use,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    contextOptions: { ...base.use?.contextOptions, reducedMotion: 'reduce' },
  },
  projects: viewports.flatMap(viewport => (['light', 'dark'] as const).map(colorScheme => ({
    name: `${viewport.width}-${colorScheme}`,
    use: { viewport, colorScheme },
  }))),
})
