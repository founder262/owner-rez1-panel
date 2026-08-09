// @ts-nocheck
// Deno Edge Function: verify-phonepe-payment
// Uses PhonePe PG 2.0 Order Status API (OAuth Client Credentials)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function formatSlotLabel(time: string): string {
  if (!time) return "";
  if (time.includes("AM") || time.includes("PM")) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let merchantTransactionId: string | null = null;
    let bookingId: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      // PhonePe webhook sends base64-encoded response field
      if (body.response) {
        try {
          const decoded = JSON.parse(atob(body.response));
          merchantTransactionId = decoded.data?.merchantOrderId || decoded.data?.merchantTransactionId;
        } catch (_) {}
      } else {
        merchantTransactionId = body.merchantTransactionId || body.merchantOrderId;
        bookingId = body.bookingId;
      }
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      merchantTransactionId = url.searchParams.get("merchantTransactionId") || url.searchParams.get("merchantOrderId");
      bookingId = url.searchParams.get("bookingId");
    }

    if (!merchantTransactionId && !bookingId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing merchantTransactionId or bookingId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch booking record ──
    let bookingRecord: any = null;
    if (bookingId) {
      const { data } = await supabaseAdmin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
      bookingRecord = data;
      if (!merchantTransactionId) {
        merchantTransactionId = bookingRecord?.phonepe_merchant_transaction_id;
      }
    } else if (merchantTransactionId) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("phonepe_merchant_transaction_id", merchantTransactionId)
        .maybeSingle();
      bookingRecord = data;
    }

    if (!bookingRecord && !merchantTransactionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Booking transaction record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Already verified ──
    if (bookingRecord?.payment_status === "paid") {
      return new Response(
        JSON.stringify({ success: true, message: "Payment already verified", booking: bookingRecord }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch PG 2.0 credentials ──
    const { data: config } = await supabaseAdmin
      .from("platform_config")
      .select("phonepe_merchant_id, phonepe_client_id, phonepe_client_secret, phonepe_client_version, phonepe_env")
      .maybeSingle();

    const merchantId    = (config?.phonepe_merchant_id    || Deno.env.get("PHONEPE_MERCHANT_ID")    || "").trim();
    const clientId      = (config?.phonepe_client_id      || Deno.env.get("PHONEPE_CLIENT_ID")      || "").trim();
    const clientSecret  = (config?.phonepe_client_secret  || Deno.env.get("PHONEPE_CLIENT_SECRET")  || "").trim();
    const clientVersion = (config?.phonepe_client_version || Deno.env.get("PHONEPE_CLIENT_VERSION") || "1").trim();
    const rawEnv        = (config?.phonepe_env || Deno.env.get("PHONEPE_ENV") || "UAT").toUpperCase().trim();
    const isProd        = ["PROD", "PRODUCTION", "LIVE"].includes(rawEnv);

    console.log(`[verify-phonepe] Env: ${rawEnv} | isProd: ${isProd} | MerchantID: ${merchantId} | OrderID: ${merchantTransactionId}`);

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "PhonePe V2 credentials not configured (client_id / client_secret missing)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ══════════════════════════════════════════════════════════
    // STEP 1: Get OAuth Access Token (PG 2.0)
    // ══════════════════════════════════════════════════════════
    const tokenUrl = isProd
      ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        client_version: String(clientVersion),
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("[verify-phonepe] Token response:", tokenRes.status, JSON.stringify(tokenData));

    if (!tokenRes.ok || !tokenData.access_token) {
      const code = tokenData?.code || tokenRes.status;
      const msg  = tokenData?.message || "OAuth token fetch failed";
      console.error(`[verify-phonepe] OAuth failed: ${code} — ${msg}`);
      return new Response(
        JSON.stringify({ success: false, error: `PhonePe OAuth (${code}): ${msg}`, booking: bookingRecord }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;

    // ══════════════════════════════════════════════════════════
    // STEP 2: Fetch Order Status (PG 2.0)
    // ══════════════════════════════════════════════════════════
    const statusUrl = isProd
      ? `https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantTransactionId}/status`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${merchantTransactionId}/status`;

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `O-Bearer ${accessToken}`,
      },
    });

    const statusData = await statusResponse.json();
    console.log("[verify-phonepe] Order status response:", statusResponse.status, JSON.stringify(statusData));

    // PG 2.0 success: state === "COMPLETED" and paymentDetails exist
    const orderState         = statusData?.state || statusData?.data?.state;
    const isSuccess          = orderState === "COMPLETED";
    const transactionId      = statusData?.data?.transactionId || statusData?.transactionId || null;
    const providerReferenceId = statusData?.data?.providerReferenceId || statusData?.providerReferenceId || null;

    if (!isSuccess) {
      // Mark as failed if terminal failure state
      if (orderState === "FAILED" || statusData?.code === "PAYMENT_ERROR" || statusData?.code === "PAYMENT_DECLINED") {
        if (bookingRecord?.id) {
          await supabaseAdmin
            .from("bookings")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", bookingRecord.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          code: statusData?.code || orderState,
          message: statusData?.message || `Payment status: ${orderState || "PENDING"}`,
          booking: bookingRecord,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Payment confirmed — update booking to paid ──
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "upcoming",
        phonepe_transaction_id: transactionId,
        phonepe_provider_reference_id: providerReferenceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingRecord.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    // ── Fetch customer name ──
    let customerName = "Customer";
    try {
      const { data: custData } = await supabaseAdmin
        .from("customers")
        .select("full_name")
        .eq("id", updatedBooking.customer_id)
        .maybeSingle();
      if (custData?.full_name) customerName = custData.full_name;
    } catch (_) {}

    // ── Fetch salon owner ──
    let salonOwnerId = null;
    let salonName = "the salon";
    if (updatedBooking.salon_id) {
      try {
        const { data: salonData } = await supabaseAdmin
          .from("salons")
          .select("owner_id, name")
          .eq("id", updatedBooking.salon_id)
          .maybeSingle();
        if (salonData) {
          salonOwnerId = salonData.owner_id;
          salonName = salonData.name;
        }
      } catch (_) {}
    }

    const formattedTime = formatSlotLabel(updatedBooking.booking_time || "");
    const serviceNames  = updatedBooking.service_names || "Service";

    // ── Owner alert & notification ──
    if (salonOwnerId && updatedBooking.salon_id) {
      await supabaseAdmin.from("owner_booking_alerts").insert({
        owner_id: salonOwnerId,
        salon_id: updatedBooking.salon_id,
        booking_id: updatedBooking.id,
        customer_name: customerName,
        service_summary: serviceNames,
        booking_time: formattedTime,
        is_read: false,
      });

      await supabaseAdmin.from("notifications").insert({
        target_user_id: salonOwnerId,
        type: "booking_created",
        title: `🔔 New Booking — ${formattedTime}`,
        message: `${customerName} booked ${serviceNames} at ${formattedTime}. Amount: ₹${updatedBooking.total_amount}.`,
        booking_id: updatedBooking.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // ── Customer confirmation notification ──
    await supabaseAdmin.from("notifications").insert({
      target_user_id: updatedBooking.customer_id,
      type: "booking_confirmed",
      title: "✅ Booking Confirmed",
      message: `Your PhonePe payment of ₹${updatedBooking.total_amount} is verified. Booking at ${salonName} on ${formattedTime} is confirmed!`,
      booking_id: updatedBooking.id,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    console.log("[verify-phonepe] SUCCESS — Booking marked paid:", updatedBooking.id);

    return new Response(
      JSON.stringify({ success: true, message: "Payment verified successfully", booking: updatedBooking }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[verify-phonepe] FATAL ERROR:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
