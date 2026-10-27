// apps/web/scripts/judgment-harness/cases/r-notice.tsx
import { mount } from './_mount'
import { InfoMatchEmpty, InfoMatchTool } from '@/components/csat/judgment/InfoMatchTool'

mount('R-NOTICE', (item, reveal) => <InfoMatchTool item={item} reveal={reveal} />, () => <InfoMatchEmpty />)
