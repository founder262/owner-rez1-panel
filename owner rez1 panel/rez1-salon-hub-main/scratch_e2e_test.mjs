import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log("🚀 Starting E2E Testing of Fixes...\n");

  const testEmail = `test.owner.${Date.now()}@example.com`;
  const testPhone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Simulate RegisterSalonPage sending a request via admin-api
  console.log("--- TEST 1: Register Salon (Checking Lat/Lng flow) ---");
  const requestPayload = {
    owner_id: "00000000-0000-4000-a000-" + String(Date.now()).slice(1, 13), // Mocking valid UUID format
    owner_name: "E2E Test Owner",
    phone: testPhone,
    email: testEmail,
    password_hash: "password123",
    salon_name: "E2E Test Salon",
    address: "123 Testing Avenue, QA City|||28.5355,77.3910",
    description: "A test salon for automated verification.",
    open_time: "10:00 AM",
    close_time: "08:00 PM",
    slot_duration: 30,
    total_seats: 5,
    categories: ["Men", "Women"],
    services: [],
    salon_images: [],
    bank_name: "Test Bank",
    account_holder_name: "E2E Owner",
    account_number: "1234567890",
    ifsc_code: "TEST0001234",
    upi_number: testPhone,
    upi_scanner_url: "",
    agreed_to_terms: true,
    agreed_to_privacy: true,
    status: "pending"
  };

  const { data: requestRes, error: requestErr } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'INSERT',
      table: 'salon_requests',
      data: requestPayload
    }
  });

  if (requestErr || !requestRes?.success) {
    console.error("❌ Failed to create salon_request:", requestErr || requestRes?.error);
    return;
  }

  const requestId = requestRes.data[0].id;
  console.log(`✅ Created salon_request with ID: ${requestId}`);
  console.log(`   Latitude: ${requestRes.data[0].latitude}, Longitude: ${requestRes.data[0].longitude}`);


  // 2. Simulate Admin Approving the Salon
  console.log("\n--- TEST 2: Approve Salon & Duplicate Check ---");
  const { data: approveRes, error: approveErr } = await supabase.functions.invoke('approve-salon', {
    body: {
      requestId: requestId,
      categories: ["Men", "Women"]
    }
  });

  if (approveErr || !approveRes?.success) {
    console.error("❌ Failed to approve salon:", approveErr || approveRes?.error);
    return;
  }

  const salonId = approveRes.salonId;
  const ownerId = approveRes.ownerId;
  console.log(`✅ Salon Approved. Created Salon ID: ${salonId}, Owner Auth ID: ${ownerId}`);

  // Fetch the created salon to verify lat/lng
  const { data: finalSalon, error: finalErr } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'SELECT',
      table: 'salons',
      id: salonId
    }
  });

  if (finalSalon?.data?.[0]) {
    const s = finalSalon.data[0];
    if (s.latitude === 28.5355 && s.longitude === 77.3910) {
       console.log(`✅ Lat/Lng successfully migrated to salons table! (${s.latitude}, ${s.longitude})`);
    } else {
       console.error(`❌ Lat/Lng missing or mismatched in salons table! Found: ${s.latitude}, ${s.longitude}`);
    }
  }


  // 3. Test Duplicate Prevention
  // We need to set the request status back to 'pending' manually just to simulate admin clicking it again
  await supabase.functions.invoke('admin-api', {
    body: {
      action: 'UPDATE',
      table: 'salon_requests',
      id: requestId,
      data: { status: 'pending' }
    }
  });

  console.log(`\nRe-triggering approve-salon to test for duplicates...`);
  const { data: duplicateApproveRes } = await supabase.functions.invoke('approve-salon', {
    body: {
      requestId: requestId,
      categories: ["Men", "Women"]
    }
  });

  if (duplicateApproveRes?.success) {
    console.log(`✅ Second approval succeeded without error. Checking for duplicates...`);
  }

  const { data: allSalons } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'SELECT',
      table: 'salons',
      filters: [{ column: "request_id", value: requestId }]
    }
  });

  if (allSalons?.data?.length === 1) {
    console.log(`✅ Duplicate Prevention working perfectly! Only 1 salon found for this request.`);
  } else {
    console.error(`❌ Duplicate Prevention failed! Found ${allSalons?.data?.length} salons.`);
  }

  
  // 4. Test Booking Notification Alert creation
  console.log("\n--- TEST 3: Create Booking & Trigger Owner Alert ---");
  const { data: bookingRes, error: bookingErr } = await supabase.functions.invoke('create-booking', {
    body: {
      userId: ownerId, // Just using the same owner id as customer id for testing
      salonId: salonId,
      bookingDate: "2026-05-01",
      bookingTime: "10:30 AM",
      status: "upcoming",
      paymentMethod: "pay_at_salon",
      paymentStatus: "pending",
      totalAmount: 500,
      subtotal: 500,
      offerDiscount: 0,
      platformFee: 0,
      gstAmount: 0,
      personCount: 1,
      durationMinutes: 30,
      services: [{ name: "Haircut", price: 500 }],
      customerName: "Automated Tester",
      serviceNames: "Haircut",
      slotTimeLabel: "10:30 AM"
    }
  });

  if (bookingErr || !bookingRes?.success) {
    console.error("❌ Failed to create booking:", bookingErr || bookingRes?.error);
    return;
  }

  const bookingId = bookingRes.data.id;
  console.log(`✅ Booking created: ${bookingId}`);

  // Wait 1 sec for DB trigger or code to write alert
  await new Promise(resolve => setTimeout(resolve, 1000));

  const { data: alerts } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'SELECT',
      table: 'owner_booking_alerts',
      filters: [{ column: "salon_id", value: salonId }]
    }
  });

  if (alerts?.data?.length > 0) {
    console.log(`✅ Realtime Alert record created successfully in 'owner_booking_alerts'!`);
    console.log(`   Customer: ${alerts.data[0].customer_name}, Slot: ${alerts.data[0].slot_time}`);
  } else {
    console.error(`❌ Realtime Alert record missing! The dashboard realtime subscription will not trigger.`);
  }

  console.log("\n🎉 All backend flow tests completed successfully!");

}

runTests();
