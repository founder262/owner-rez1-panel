// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      userId,
      salonId,
      bookingDate,
      bookingTime,
      status,
      paymentMethod,
      paymentStatus,
      totalAmount,
      subtotal,
      offerDiscount,
      platformFee,
      gstAmount,
      personCount,
      durationMinutes,
      services,
      razorpayPaymentId,
      customerName,
      serviceNames,
      slotTimeLabel,
    } = await req.json()

    if (!userId || !salonId || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required booking fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    // 1. Ensure customer record exists (upsert so it's idempotent)
    if (customerName) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authUser?.user) {
        await supabaseAdmin.from('customers').upsert({
          id: userId,
          full_name: customerName,
          email: authUser.user.email || '',
          phone: authUser.user.user_metadata?.phone || '',
        }, { onConflict: 'id' })
      }
    }

    // 2. Insert the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: userId,
        salon_id: salonId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        status: status,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        subtotal: subtotal,
        offer_discount: offerDiscount,
        platform_fee: platformFee,
        gst_amount: gstAmount || 0,
        person_count: personCount,
        duration_minutes: durationMinutes,
        services: services,
        razorpay_payment_id: razorpayPaymentId || null,
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Booking insert error:', bookingError)
      return new Response(
        JSON.stringify({ success: false, error: bookingError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 3. Insert owner booking alert (for notification)
    await supabaseAdmin.from('owner_booking_alerts').insert({
      salon_id: salonId,
      customer_name: customerName || 'Customer',
      service_summary: serviceNames || 'Service',
      slot_time: slotTimeLabel || bookingTime,
      booking_id: booking.id,
    })

    // 4. Insert customer notification
    await supabaseAdmin.from('notifications').insert({
      title: 'Booking Confirmed!',
      message: `Your booking at the salon for ${serviceNames || 'Service'} on ${bookingDate} at ${slotTimeLabel || bookingTime} is confirmed.`,
      notif_type: 'booking',
      target_type: 'broadcast_customers'
    })

    // 5. Insert admin notification
    await supabaseAdmin.from('notifications').insert({
      title: 'New Booking Created',
      message: `A new booking was created by ${customerName || 'Customer'} for ${serviceNames || 'Service'} on ${bookingDate} at ${slotTimeLabel || bookingTime}.`,
      notif_type: 'booking',
      target_type: 'broadcast_all'
    })

    return new Response(
      JSON.stringify({ success: true, data: booking }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('Create Booking Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

