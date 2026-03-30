'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get('error') === 'true';

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* ── Background Aesthetics ─────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-primary/5 blur-[120px] animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="w-full max-w-[400px] z-10 px-4"
      >
        <Card className="bg-card/40 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
          <CardHeader className="space-y-1 pb-6 px-8 pt-8 text-center">
            {hasError ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20 mx-auto">
                  <XCircle className="text-rose-400" size={24} />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                  Verification Failed
                </CardTitle>
                <CardDescription className="text-sm font-medium text-muted-foreground tracking-tight">
                  The confirmation link is invalid or has expired. Please try registering again.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20 mx-auto">
                  <CheckCircle2 className="text-emerald-400" size={24} />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                  Email Verified
                </CardTitle>
                <CardDescription className="text-sm font-medium text-muted-foreground tracking-tight">
                  Your email has been validated successfully. You can now sign in to your account.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <Link href="/login" className="w-full">
              <Button className="w-full h-11 rounded-xl font-semibold text-sm gap-2 tracking-tight cursor-pointer">
                <LogIn size={16} />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function EmailVerifiedPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerifiedContent />
    </Suspense>
  );
}
