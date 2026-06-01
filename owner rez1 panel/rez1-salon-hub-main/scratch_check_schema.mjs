import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('owner_booking_alerts').select('*').limit(1);
  if (error) {
     console.log("Error querying directly:", error);
  } else {
     console.log("Direct query data:", data);
  }
}

check();
