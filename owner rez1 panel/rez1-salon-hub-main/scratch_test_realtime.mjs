import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRealtime() {
  console.log("Listening for bookings...");
  
  const sub = supabase.channel('test-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, payload => {
      console.log("✅ REALTIME RECEIVED!", payload);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log("Subscription status:", status);
      if (status === 'SUBSCRIBED') {
         // trigger an insert using create-booking edge function
         console.log("Triggering booking...");
         supabase.functions.invoke('create-booking', {
            body: {
              userId: 'db6558d6-57c9-44b3-a391-b2ca33ccc967',
              salonId: 'db6558d6-57c9-44b3-a391-b2ca33ccc967',
              bookingDate: "2026-05-01",
              bookingTime: "10:30 AM",
              status: "upcoming",
              paymentMethod: "pay_at_salon",
              paymentStatus: "pending",
              totalAmount: 500,
              subtotal: 500,
              durationMinutes: 30,
              personCount: 1,
              services: [{ name: "Haircut", price: 500 }],
              customerName: "Realtime Tester",
              serviceNames: "Haircut",
              slotTimeLabel: "10:30 AM"
            }
         }).then(res => console.log("Insert Response:", res));
      }
    });

  setTimeout(() => {
    console.error("❌ TIMEOUT - No realtime event received in 10 seconds.");
    process.exit(1);
  }, 10000);
}

testRealtime();
