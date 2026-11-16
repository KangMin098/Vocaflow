// apps/web/scripts/judgment-harness/cases/r-mood.tsx
import { mount } from './_mount'
import { MoodTool } from '@/components/csat/judgment/MoodTool'

mount('R-MOOD', (item, reveal) => <MoodTool item={item} reveal={reveal} />)
