'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, UserPlus, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      toast.success('Credentials requested. Please verify your email.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed. verify distillation requirements.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* ── Background Aesthetics ─────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-primary/10 blur-[120px] animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="w-full max-w-[400px] z-10 px-4"
      >
        <Card className="bg-card/40 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
          <CardHeader className="space-y-1 pb-6 px-8 pt-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 mx-auto">
              <UserPlus className="text-primary" size={24} />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Register</CardTitle>
            <CardDescription className="text-sm font-medium text-muted-foreground tracking-tight">
              Establish your architecture credentials.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 px-8 pb-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase ml-1">Architect Name</Label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-3 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <Input 
                    placeholder="Full Name" 
                    className="bg-background/40 border-white/5 pl-11 h-11 rounded-xl focus-visible:ring-primary/30 transition-all font-medium"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase ml-1">Email Identifier</Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-3 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <Input 
                    type="email" 
                    placeholder="email@artkey.creative" 
                    className="bg-background/40 border-white/5 pl-11 h-11 rounded-xl focus-visible:ring-primary/30 transition-all font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase ml-1">Security Pass</Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-3 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="bg-background/40 border-white/5 pl-11 h-11 rounded-xl focus-visible:ring-primary/30 transition-all font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-6 px-8 pb-10 pt-0">
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 rounded-2xl shadow-xl shadow-primary/20 font-bold tracking-tight transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Request Access"}
              </Button>
              <p className="text-xs text-center text-muted-foreground font-medium">
                Established Architect? {" "}
                <Link href="/login" className="text-primary hover:underline hover:text-primary/80 transition-all font-bold">
                  Authenticate
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
