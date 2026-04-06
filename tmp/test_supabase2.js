require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

async function test() {
  const { data, error } = await supabase
      .from('assignment_assignees')
      .select('assignment_id, profiles!assignment_assignees_user_id_fkey(full_name)')
      .limit(1);
  console.log("error:", error);
  console.dir(data, { depth: null });
}

test();
