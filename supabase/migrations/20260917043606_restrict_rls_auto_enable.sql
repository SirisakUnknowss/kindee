-- This event-trigger helper only needs to run when PostgreSQL fires the event.
-- It must not be exposed as a callable RPC to browser-facing roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
