// apps/web/scripts/judgment-harness/cases/r-order.tsx
import { mount } from './_mount'
import { OrderTool } from '@/components/csat/judgment/OrderTool'

mount('R-ORDER', (item, reveal) => <OrderTool item={item} reveal={reveal} />)
