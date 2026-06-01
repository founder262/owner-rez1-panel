import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'SELECT',
      table: 'owner_booking_alerts',
      query: '*'
    }
  });
  const sorted = (data?.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  console.log("LAST 10 ALERTS:");
  sorted.slice(0, 10).forEach(x => {
    console.log(`- ID: ${x.id}, Name: ${x.customer_name}, Time: ${x.booking_time}, Read: ${x.is_read}, Created: ${x.created_at}`);
  });
}

check();

