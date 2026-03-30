import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/auth/email-verified';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sign out so the user lands on the success page without a session
      // (they should log in manually after verification)
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, redirect to an error state on the verified page
  return NextResponse.redirect(`${origin}/auth/email-verified?error=true`);
}
