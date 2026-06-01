const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lidptdtnsvulvjdwkwvz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI');
// We need the service role key to query auth.users, but we can just query salon_requests to see what email correlates to that request.
async function main() {
  const { data: reqs } = await supabase.from('salon_requests').select('*');
  console.log("REQS:\\n", JSON.stringify(reqs, null, 2));
}
main();
