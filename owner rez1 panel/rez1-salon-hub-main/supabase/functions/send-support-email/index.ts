// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { salonName, ownerName, name, email, phone, message, source } = await req.json()
    const resolvedName = ownerName || name || 'N/A'
    const emailSource = source === 'customer_help_center' ? 'Customer Panel' : 'Owner Panel'

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY secret not set in Supabase')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const emailBody = `
New support request from REZ1 ${emailSource}

Source: ${emailSource}
Salon Name: ${salonName || 'N/A'}
User Name: ${resolvedName}
Email: ${email || 'N/A'}
Phone: ${phone || 'N/A'}

Message / Issue:
${message || '(No message provided)'}

---
Sent via REZ1 Support Button
    `.trim()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'REZ1 Support <support@rez1.in>',
        to: ['contact@rez1.in'],
        reply_to: email || 'noreply@rez1.in',
        subject: `Support Request [${emailSource}] - ${salonName || resolvedName}`,
        text: emailBody,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to send email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('send-support-email error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

