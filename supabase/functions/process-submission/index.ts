import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubmissionPayload {
  form_id: string
  estate_id: string
  session_id: string
  answers: Record<string, string | string[]>
  question_meta: Array<{ id: string; question_type: string; category_tag: string | null }>
  metadata: {
    user_agent: string
    device_type: string
    browser: string
    os: string
    referral_source?: string
    utm_medium?: string
    utm_campaign?: string
  }
  honeypot?: string
}

// Parse user-agent into device/browser/OS
function parseUA(ua: string) {
  const device = /tablet|ipad/i.test(ua) ? 'tablet' : /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop'
  const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
    : ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
    : ua.includes('Edg') ? 'Edge' : 'Unknown'
  const os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS'
    : ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
    : ua.includes('Linux') ? 'Linux' : 'Unknown'
  return { device, browser, os }
}

// Evaluate a single logic rule against answers
function evalRule(operator: string, valueToMatch: string, answer: string | string[]): boolean {
  const answerArr = Array.isArray(answer) ? answer : [answer]
  switch (operator) {
    case '=': return answerArr.includes(valueToMatch)
    case '!=': return !answerArr.includes(valueToMatch)
    case 'includes': return answerArr.some(a => a === valueToMatch || a.includes(valueToMatch))
    case 'excludes': return !answerArr.some(a => a === valueToMatch)
    case 'greater_than': return Number(answerArr[0]) > Number(valueToMatch)
    case 'less_than': return Number(answerArr[0]) < Number(valueToMatch)
    default: return false
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const payload: SubmissionPayload = await req.json()

    // ── 1. Honeypot check ──
    if (payload.honeypot) {
      // Silent 200 for bots
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 2. Parse metadata ──
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ua = payload.metadata.user_agent || req.headers.get('user-agent') || ''
    const { device, browser, os } = parseUA(ua)

    // ── 3. Duplicate check: same WhatsApp within 24h ──
    const phoneQ = payload.question_meta.find(q => q.category_tag === 'identity' && q.question_type === 'phone')
    const phoneAnswer = phoneQ ? payload.answers[phoneQ.id] as string : null
    let isDuplicate = false

    if (phoneAnswer) {
      const { data: existing } = await supabase
        .from('answers')
        .select('response_id, responses!inner(submission_timestamp)')
        .eq('question_id', phoneQ!.id)
        .eq('answer_value', phoneAnswer)
        .gte('responses.submission_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
      if (existing && existing.length > 0) isDuplicate = true
    }

    // ── 4. Load logic rules for flag evaluation ──
    const { data: rules } = await supabase
      .from('logic_rules')
      .select('*')
      .eq('action', 'flag')

    // ── 5. Compute flags ──
    const flags = {
      priority_flag: false,
      churn_risk_flag: false,
      high_referrer_flag: false,
      upsell_candidate: false,
    }

    // PATH_D always sets priority
    const entryQ = payload.question_meta.find(q => q.category_tag === 'entry')
    if (entryQ && payload.answers[entryQ.id] === 'PATH_D') flags.priority_flag = true

    // Evaluate all flag rules
    for (const rule of (rules || [])) {
      const answer = payload.answers[rule.depends_on_question_id]
      if (answer !== undefined && rule.flag_type && evalRule(rule.operator, rule.value_to_match, answer)) {
        flags[rule.flag_type as keyof typeof flags] = true
      }
    }

    // ── 6. Compute customer tier ──
    const wtpQ = payload.question_meta.find(q => q.category_tag === 'willingness_to_pay')
    const usageQ = payload.question_meta.find(q => q.category_tag === 'usage_volume')
    let customerTier: 'high_value' | 'standard' | 'budget' = 'standard'

    if (wtpQ && usageQ) {
      const wtp = payload.answers[wtpQ.id] as string
      const usage = payload.answers[usageQ.id] as string
      if ((wtp === '10000_15000' || wtp === 'gt_15000') && (usage === '25_50gb' || usage === 'gt_50gb')) {
        customerTier = 'high_value'
      } else if (wtp === 'lt_5000') {
        customerTier = 'budget'
      }
    }

    // ── 7. Insert response ──
    const { data: response, error: respErr } = await supabase
      .from('responses')
      .insert({
        form_id: payload.form_id,
        estate_id: payload.estate_id,
        session_id: payload.session_id,
        ip_address: ip,
        user_agent: ua,
        device_type: device,
        browser,
        os,
        phone_number: phoneAnswer,
        customer_tier: customerTier,
        source: 'live_form',
        is_duplicate: isDuplicate,
        referral_source: payload.metadata.referral_source || null,
        utm_medium: payload.metadata.utm_medium || null,
        utm_campaign: payload.metadata.utm_campaign || null,
        ...flags,
      })
      .select('id')
      .single()

    if (respErr || !response) {
      throw new Error(respErr?.message || 'Failed to insert response')
    }

    // ── 8. Batch insert answers ──
    const answerRows: Array<{ response_id: string; question_id: string; answer_value: string }> = []

    for (const q of payload.question_meta) {
      const val = payload.answers[q.id]
      if (val === undefined || val === null || val === '') continue
      answerRows.push({
        response_id: response.id,
        question_id: q.id,
        answer_value: Array.isArray(val) ? JSON.stringify(val) : val,
      })
    }

    if (answerRows.length > 0) {
      const { error: ansErr } = await supabase.from('answers').insert(answerRows)
      if (ansErr) throw new Error(ansErr.message)
    }

    // ── 9. Phase 2 hooks (placeholders) ──
    if (flags.priority_flag) {
      // TODO Phase 2: trigger WhatsApp notification via Twilio
      console.log(`[HOOK] Priority flag set for response ${response.id}`)
    }
    if (flags.upsell_candidate) {
      // TODO Phase 2: add to nurture queue
      console.log(`[HOOK] Upsell candidate: response ${response.id}`)
    }

    return new Response(
      JSON.stringify({ success: true, response_id: response.id, flags, tier: customerTier, is_duplicate: isDuplicate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
