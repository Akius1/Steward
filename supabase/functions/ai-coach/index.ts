// Steward AI Coach — Supabase Edge Function
// Deploy: supabase functions deploy ai-coach
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FREE_LIMIT = 5;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    // ── Supabase client (user-scoped) ─────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return json({ error: 'service_misconfigured' }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error('Auth error:', userErr?.message);
      return json({ error: 'unauthorized' }, 401);
    }

    // ── Parse request body ────────────────────────────────────
    let messages: any[], financialContext: any;
    try {
      const body = await req.json();
      messages = body.messages ?? [];
      financialContext = body.financialContext ?? {};
    } catch (e) {
      console.error('Body parse error:', e);
      return json({ error: 'bad_request' }, 400);
    }

    // ── Check usage (gracefully handle missing columns) ───────
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear  = now.getFullYear();

    const isPremium = profile?.subscription === 'premium';

    // ai_messages_used might not exist yet if migration hasn't run
    let used = 0;
    if (typeof profile?.ai_messages_used === 'number') {
      const sameMonth = profile.ai_messages_month === curMonth &&
                        profile.ai_messages_year  === curYear;
      used = sameMonth ? profile.ai_messages_used : 0;
    }

    if (!isPremium && used >= FREE_LIMIT) {
      return json({ error: 'limit_exceeded', used, limit: FREE_LIMIT, isPremium }, 429);
    }

    // ── Verify Anthropic key ──────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY secret not set');
      return json({ error: 'service_unavailable', detail: 'API key not configured' }, 503);
    }

    // ── Build system prompt ───────────────────────────────────
    const currency = financialContext?.currency ?? 'NGN';
    const systemPrompt = `You are Steward, a warm and knowledgeable personal financial coach inside the Steward budgeting app. You have real-time access to the user's financial data and give specific, data-driven advice — never generic.

USER'S FINANCIAL SNAPSHOT:
${JSON.stringify(financialContext, null, 2)}

COACHING STYLE:
- Reference their actual numbers (income, savings rate, grade, goals)
- Be concise — 2 to 4 sentences max per response
- Be encouraging but honest; flag red flags clearly
- Suggest one concrete next action when relevant
- Use their currency (${currency}) when mentioning amounts
- Never repeat "As your financial coach" — just coach naturally`;

    // ── Call Claude ───────────────────────────────────────────
    console.log('Calling Claude API for user:', user.id, 'used:', used);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 350,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude API error:', claudeRes.status, errText);
      return json({
        error: 'ai_error',
        detail: `Claude returned ${claudeRes.status}`,
        hint: errText.slice(0, 200),
      }, 502);
    }

    const claudeData = await claudeRes.json();
    const reply = claudeData.content?.[0]?.text ?? '';

    if (!reply) {
      console.error('Claude returned empty content:', JSON.stringify(claudeData));
      return json({ error: 'empty_response' }, 502);
    }

    // ── Persist updated usage (best-effort, non-fatal) ────────
    try {
      await supabase.from('profiles').update({
        ai_messages_used:  used + 1,
        ai_messages_month: curMonth,
        ai_messages_year:  curYear,
      }).eq('id', user.id);
    } catch (updateErr) {
      // Don't fail the request if usage tracking fails
      console.error('Usage update failed (non-fatal):', updateErr);
    }

    console.log('Success — reply length:', reply.length);

    return json({ reply, used: used + 1, limit: FREE_LIMIT, isPremium });

  } catch (err) {
    console.error('Unhandled edge function error:', err);
    return json({ error: 'internal_error', detail: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
