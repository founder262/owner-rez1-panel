const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lidptdtnsvulvjdwkwvz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTYxMTQsImV4cCI6MjA5MjE5MjExNH0.uExG_Jrt5n4CYEl-7lqXsEcvbze_CV4NCVzBrUhcWZI');

async function main() {
  const { data: owners } = await supabase.from('owners').select('*');
  console.log("OWNERS:\\n", JSON.stringify(owners, null, 2));
  const { data: salons } = await supabase.from('salons').select('*');
  console.log("SALONS:\\n", JSON.stringify(salons, null, 2));
}
main();
