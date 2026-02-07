import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
serve((req) => {
  const auth = req.headers.get('Authorization') || '';
  if (auth !== 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response('Unauthorized', { status: 401 });
  }
  return new Response(JSON.stringify({
    db_url: Deno.env.get('SUPABASE_DB_URL'),
    url: Deno.env.get('SUPABASE_URL'),
  }), { headers: { 'Content-Type': 'application/json' } });
});
