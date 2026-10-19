-- scripts/db/factory-i1/d3-package/stop-writes.sql
-- 비파괴 복구: 모든 기록·조회 보존, 쓰기 RPC만 정지. 공유 DB 실행은 별도 승인.
begin;
revoke execute on function public.factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid) from service_role;
revoke execute on function public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid) from service_role;
revoke execute on function public.factory_product_order_withdraw(uuid,text,integer,text,text,uuid) from service_role;
commit;
