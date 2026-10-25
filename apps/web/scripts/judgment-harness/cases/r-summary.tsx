// apps/web/scripts/judgment-harness/cases/r-summary.tsx
import { mount } from './_mount'
import { SummaryTool } from '@/components/csat/judgment/SummaryTool'

mount('R-SUMMARY', (item, reveal) => <SummaryTool item={item} reveal={reveal} />)
