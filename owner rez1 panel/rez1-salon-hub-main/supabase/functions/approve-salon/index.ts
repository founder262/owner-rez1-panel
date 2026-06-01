// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // BUG A4 FIX — accept reviewedBy and reviewedAt from admin panel
    const { requestId, locationId, categories, reviewedBy, reviewedAt } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ success: false, error: "requestId is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ??
        "https://lidptdtnsvulvjdwkwvz.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo",
    );

    // 1. Fetch the full salon request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("salon_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return new Response(
        JSON.stringify({ success: false, error: "Request not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    if (request.status !== "pending") {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Request has already been processed (status: " +
            request.status +
            ")",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Decode lat/lng from address string
    let finalAddress = request.address || "";
    let finalLat = null;
    let finalLng = null;
    if (finalAddress.includes("|||")) {
      const parts = finalAddress.split("|||");
      finalAddress = parts[0];
      const coords = parts[1].split(",");
      if (coords[0] && !isNaN(parseFloat(coords[0]))) finalLat = parseFloat(coords[0]);
      if (coords[1] && !isNaN(parseFloat(coords[1]))) finalLng = parseFloat(coords[1]);
    }

    // Removed the ATOMIC LOCK that sets status to 'processing'
    // because it violates the salon_requests_status_check constraint ('pending', 'approved', 'rejected')
    // We rely on the initial request.status !== 'pending' check and UI disabled states to prevent double clicks.

    // 1b. Auto-detect location_id from salon address if not passed explicitly
    let resolvedLocationId = locationId || null;
    if (!resolvedLocationId) {
      const { data: allLocations } = await supabaseAdmin
        .from("locations")
        .select("id, name")
        .eq("is_active", true);

      if (allLocations && allLocations.length > 0) {
        const addressLower = (request.address || "").toLowerCase();
        const matched = allLocations.find(
          (loc: any) =>
            addressLower.includes(loc.name.toLowerCase()) ||
            loc.name.toLowerCase().includes(addressLower.split(",")[0].trim()),
        );
        if (matched) {
          resolvedLocationId = matched.id;
          console.log(
            `Auto-matched location: ${matched.name} (${matched.id}) from address: ${request.address}`,
          );
        } else {
          console.log(
            `No location match found for address: ${request.address}`,
          );
        }
      }
    }

    // 2. Check if auth user already exists for this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === request.email,
    );

    let userId;

    if (existingUser) {
      // User already exists (registered via OTP before). Just use their id.
      userId = existingUser.id;
    } else {
      // 3. Create Supabase Auth user with the password from salon_requests
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: request.email,
          password: request.password_hash, // The owner created this password during registration
          email_confirm: true, // Auto-confirm so they can login immediately
        });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: authError?.message || "Failed to create auth user",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        );
      }

      userId = authData.user.id;
    }

    // 4. Create or update the owners record
    const { error: ownerError } = await supabaseAdmin.from("owners").upsert(
      {
        id: userId,
        full_name: request.owner_name,
        phone: request.phone,
        email: request.email,
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (ownerError) {
      console.error("Owner insert error:", ownerError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create owner record: " + ownerError.message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // 5. Check if salon already exists for this owner/request (prevent duplicates)
    const { data: existingSalons, error: existErr } = await supabaseAdmin
      .from("salons")
      .select("id")
      .or(`owner_id.eq.${userId},request_id.eq.${requestId}`)
      .limit(1);

    const existingSalon =
      existingSalons && existingSalons.length > 0 ? existingSalons[0] : null;

    let salon: any;

    // --- RAZORPAY LINKED ACCOUNT CREATION ---
    let linkedAccountId = null;
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && request.account_number && request.ifsc_code) {
      try {
        const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        
        const rzpRes = await fetch("https://api.razorpay.com/v2/accounts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${rzpAuth}`
          },
          body: JSON.stringify({
            name: request.owner_name,
            email: request.email,
            tnc_accepted: true,
            account_details: {
              business_name: request.salon_name,
              business_type: "individual"
            },
            bank_account: {
              ifsc_code: request.ifsc_code,
              beneficiary_name: request.account_holder_name || request.owner_name,
              account_number: request.account_number
            }
          })
        });

        const rzpData = await rzpRes.json();
        
        if (rzpRes.ok && rzpData.id) {
          linkedAccountId = rzpData.id;
          console.log("Successfully created Razorpay Linked Account:", linkedAccountId);
        } else {
          console.error("Razorpay Account Creation Failed:", rzpData);
        }
      } catch (err) {
        console.error("Error creating Razorpay Linked Account:", err);
      }
    }

    if (existingSalon) {
      // Salon already exists — update it instead of creating a duplicate
      console.log(
        "Salon already exists for this owner/request. Updating instead of inserting.",
      );
      const { data: updatedSalon, error: updateError } = await supabaseAdmin
        .from("salons")
        .update({
          name: request.salon_name,
          address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
          description: request.description || "",
          open_time: request.open_time || "10:00",
          close_time: request.close_time || "20:00",
          slot_duration: request.slot_duration || 30,
          total_seats: request.total_seats || 4,
          is_approved: true,
          is_verified: true,
          is_visible: true,
          is_open: true,
          salon_images: request.salon_images || [],
          account_holder_name: request.account_holder_name,
          bank_name: request.bank_name,
          account_number: request.account_number,
          ifsc_code: request.ifsc_code,
          upi_number: request.upi_number,
          upi_scanner_url: request.upi_scanner_url,
          ...(linkedAccountId ? { razorpay_linked_account_id: linkedAccountId } : {}),
          ...(resolvedLocationId ? { location_id: resolvedLocationId } : {}),
          ...(categories && categories.length > 0 ? { categories } : (request.categories && request.categories.length > 0 ? { categories: request.categories } : {})),
        })
        .eq("id", existingSalon.id)
        .select()
        .single();

      if (updateError) {
        console.error("Salon update error:", updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to update salon: " + updateError.message,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        );
      }
      salon = updatedSalon;
    } else {
      // Create a new salon record
      const { data: newSalon, error: salonError } = await supabaseAdmin
        .from("salons")
        .insert({
          owner_id: userId,
          request_id: requestId,
          name: request.salon_name,
          address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
          description: request.description || "",
          open_time: request.open_time || "10:00",
          close_time: request.close_time || "20:00",
          slot_duration: request.slot_duration || 30,
          total_seats: request.total_seats || 4,
          is_approved: true,
          is_verified: true,
          is_visible: true,
          is_open: true,
          salon_images: request.salon_images || [],
          account_holder_name: request.account_holder_name,
          bank_name: request.bank_name,
          account_number: request.account_number,
          ifsc_code: request.ifsc_code,
          upi_number: request.upi_number,
          upi_scanner_url: request.upi_scanner_url,
          ...(linkedAccountId ? { razorpay_linked_account_id: linkedAccountId } : {}),
          ...(resolvedLocationId ? { location_id: resolvedLocationId } : {}),
          ...(categories && categories.length > 0 ? { categories } : (request.categories && request.categories.length > 0 ? { categories: request.categories } : {})),
        })
        .select()
        .single();

      if (salonError) {
        console.error("Salon insert error:", salonError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create salon: " + salonError.message,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        );
      }
      salon = newSalon;
    }

    // 6. Sync services to the services table (delete old ones first to avoid duplicates, then re-insert)
    if (request.services && request.services.length > 0) {
      // Remove any previously inserted services for this salon
      await supabaseAdmin.from("services").delete().eq("salon_id", salon.id);

      const servicesPayload = request.services.map((svc: any) => ({
        salon_id: salon.id,
        name: svc.name,
        price: Number(svc.price) || 0,
        duration: svc.duration || 30,
        category: svc.category || "",
        is_active: true,
      }));
      const { error: svcErr } = await supabaseAdmin
        .from("services")
        .insert(servicesPayload);
      if (svcErr) console.error("Services insert error:", svcErr);
    }

    // 7. Update salon_requests status to 'approved' and link owner_id
    // BUG A4 FIX — also write reviewed_by (admin id) and reviewed_at timestamp
    await supabaseAdmin
      .from("salon_requests")
      .update({
        status: "approved",
        owner_id: userId,
        reviewed_by: reviewedBy || null,
        reviewed_at: reviewedAt || new Date().toISOString(),
      })
      .eq("id", requestId);

    // 7b. Refresh salons_count for the matched location
    if (resolvedLocationId) {
      const { count } = await supabaseAdmin
        .from("salons")
        .select("id", { count: "exact", head: true })
        .eq("location_id", resolvedLocationId)
        .eq("is_approved", true)
        .eq("is_visible", true);
      if (count !== null) {
        await supabaseAdmin
          .from("locations")
          .update({ salons_count: count })
          .eq("id", resolvedLocationId);
        console.log(
          `Updated salons_count for location ${resolvedLocationId}: ${count}`,
        );
      }
    }

    // 8. Send Approval Email with credentials (Requires RESEND_API_KEY to be set in Supabase edge function secrets)
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        const ownerPassword = request.password_hash || "Use OTP login";
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to REZ1</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px 40px 30px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,#e94560,#ff6b6b);-webkit-background-clip:text;color:transparent;font-size:36px;font-weight:900;letter-spacing:3px;">REZ1</div>
              <p style="color:#a0aec0;margin:8px 0 0;font-size:14px;letter-spacing:1px;text-transform:uppercase;">Salon Management Platform</p>
            </td>
          </tr>

          <!-- Approval Badge -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:0 40px 40px;text-align:center;">
              <div style="background:linear-gradient(135deg,#e94560,#ff6b6b);display:inline-block;border-radius:50px;padding:10px 28px;margin-bottom:20px;">
                <span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;">✓ APPROVED</span>
              </div>
              <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 10px;">Congratulations, ${request.owner_name}! 🎉</h1>
              <p style="color:#a0aec0;font-size:16px;margin:0;">Your salon is live on REZ1!</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:40px;">
              
              <!-- Salon Name Highlight -->
              <div style="background:linear-gradient(135deg,#fff5f5,#fff0f0);border-left:4px solid #e94560;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
                <p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Approved Salon</p>
                <p style="color:#1a1a2e;font-size:22px;font-weight:800;margin:0;">✂ ${request.salon_name}</p>
              </div>

              <p style="color:#4a5568;font-size:16px;line-height:1.8;margin:0 0 28px;">
                We are delighted to inform you that your salon registration has been <strong style="color:#e94560;">reviewed and approved</strong> by the REZ1 team.
                You can now start managing your salon, set up your services, and accept bookings from customers right away!
              </p>

              <!-- Credentials Box -->
              <div style="background:#f7fafc;border:2px solid #e2e8f0;border-radius:12px;padding:28px;margin-bottom:28px;">
                <h3 style="color:#1a1a2e;font-size:16px;font-weight:700;margin:0 0 20px;text-transform:uppercase;letter-spacing:1px;">🔑 Your Login Credentials</h3>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
                      <p style="color:#718096;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Owner Name</p>
                      <p style="color:#1a1a2e;font-size:16px;font-weight:600;margin:0;">${request.owner_name}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
                      <p style="color:#718096;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Salon Name</p>
                      <p style="color:#1a1a2e;font-size:16px;font-weight:600;margin:0;">${request.salon_name}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
                      <p style="color:#718096;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Login Email</p>
                      <p style="color:#e94560;font-size:16px;font-weight:700;margin:0;">${request.email}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;">
                      <p style="color:#718096;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Password</p>
                      <p style="color:#e94560;font-size:16px;font-weight:700;margin:0;font-family:monospace;background:#fff;border:1px dashed #e94560;display:inline-block;padding:6px 14px;border-radius:6px;">${ownerPassword}</p>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:20px;padding:14px;background:#fffbf0;border:1px solid #f6e05e;border-radius:8px;">
                  <p style="color:#744210;font-size:13px;margin:0;">⚠️ <strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.</p>
                </div>
              </div>

              <!-- Login Steps -->
              <div style="margin-bottom:28px;">
                <h3 style="color:#1a1a2e;font-size:16px;font-weight:700;margin:0 0 16px;">How to Get Started</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:10px 0;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="background:#e94560;color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">1</span>
                        <p style="color:#4a5568;font-size:15px;margin:0 0 0 12px;line-height:1.6;">Visit the <strong>REZ1 Owner Panel</strong> login page</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="background:#e94560;color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">2</span>
                        <p style="color:#4a5568;font-size:15px;margin:0 0 0 12px;line-height:1.6;">Enter your <strong>email</strong> and <strong>password</strong> from the credentials above, <em>or</em> use <strong>OTP login</strong> for a passwordless experience</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <div style="display:flex;align-items:flex-start;">
                        <span style="background:#e94560;color:#fff;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">3</span>
                        <p style="color:#4a5568;font-size:15px;margin:0 0 0 12px;line-height:1.6;">Set up your services, manage slots, and start <strong>accepting bookings!</strong></p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1a1a2e;padding:30px 40px;text-align:center;">
              <p style="color:#a0aec0;font-size:14px;margin:0 0 8px;">Welcome to the REZ1 family, <strong style="color:#ffffff;">${request.owner_name}</strong>! 🚀</p>
              <p style="color:#718096;font-size:13px;margin:0;">If you have any questions, reply to this email or contact our support team.</p>
              <p style="color:#4a5568;font-size:12px;margin:20px 0 0;">© 2025 REZ1 · All rights reserved</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "REZ1 <support@rez1.in>",
            to: request.email,
            subject: `🎉 Congratulations ${request.owner_name}! Your Salon "${request.salon_name}" is Approved on REZ1`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const resError = await emailResponse.text();
          console.error("Failed to send email via Resend:", resError);
          return new Response(
            JSON.stringify({
              success: true,
              message: `${request.salon_name} approved, but email failed.`,
              emailError: resError,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          console.log("Approval email sent successfully to", request.email);
        }
      } catch (err) {
        console.error("Error sending email:", err);
      }
    } else {
      console.log(
        "RESEND_API_KEY not set. Skipping email sending. To send emails, please set RESEND_API_KEY in your Supabase edge function secrets.",
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${request.salon_name} approved! Owner account created.`,
        salonId: salon.id,
        ownerId: userId,
        ownerEmail: request.email,
        loginPassword: request.password_hash,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("Approve Salon Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

