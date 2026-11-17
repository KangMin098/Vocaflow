// apps/web/scripts/judgment-harness/cases/r-fact.tsx
import { mount } from './_mount'
import { InfoMatchEmpty, InfoMatchTool } from '@/components/csat/judgment/InfoMatchTool'

mount('R-FACT', (item, reveal) => <InfoMatchTool item={item} reveal={reveal} />, () => <InfoMatchEmpty />)
