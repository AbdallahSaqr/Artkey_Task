require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

async function test() {
  const { data, error } = await supabase.from('assignments').select('*').limit(1);
  console.log("assignments error:", error);
  console.log("assignments data:", data);
}

test();
