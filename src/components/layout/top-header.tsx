'use client';

import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sparkles, ChevronRight, Shield, User as UserIcon } from 'lucide-react';
import { AIAssistantSheet } from '@/components/AIAssistantSheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationPanel } from '@/components/NotificationPanel';
import { MobileNav } from './mobile-nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

type ProfileRow = {
  full_name: string | null;
  role: string;
  avatar_url: string | null;
};

function isProfileRow(value: unknown): value is ProfileRow {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.role === 'string' &&
    ('full_name' in candidate) &&
    ('avatar_url' in candidate)
  );
}

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    async function fetchAndSubscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch initial
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (data) setProfile(data);

      // Subscribe to changes
      subscription = supabase
        .channel(`profile:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<ProfileRow>) => {
            if (isProfileRow(payload.new)) {
              setProfile(payload.new);
            }
          }
        )
        .subscribe();
    }

    fetchAndSubscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Session de-authenticated successfully.');
      router.push('/login');
      router.refresh();
    } catch (error) {
      toast.error('De-authentication failed. please retry.');
    }
  };

  const paths = pathname === '/'
    ? ['Dashboard']
    : (pathname || '').split('/').filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1));

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-4 md:px-6 gap-2 md:gap-4 bg-background/70 backdrop-blur-xl border-b border-border/50 transition-all">

      {/* ── Mobile Menu Toggle ────────────────────────────────────────────────── */}
      <MobileNav />

      <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mr-6 select-none font-medium">
        <span className="tracking-tight hover:text-foreground cursor-pointer transition-colors">Artkey</span>
        {paths.map((path, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <ChevronRight size={14} className="opacity-50" />
            <span
              className={`tracking-tight ${idx === paths.length - 1 ? 'text-foreground' : 'hover:text-foreground cursor-pointer transition-colors'
                }`}
            >
              {path}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <AIAssistantSheet>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-[10px] md:text-xs font-semibold tracking-tight border border-violet-500/20"
        >
          <Sparkles size={13} />
          <span className="hidden xs:inline">AI Assistant</span>
        </motion.button>
      </AIAssistantSheet>

      <NotificationPanel />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger>
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="
              flex-shrink-0 flex items-center gap-2 p-1 pr-3 rounded-full ring-1 ring-border bg-muted/30 backdrop-blur-xl
              hover:ring-foreground/20 transition-all duration-150 ml-1 cursor-pointer
            "
            aria-label="User menu"
          >
            <div className="relative w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary ring-1 ring-primary/20 overflow-hidden">
              {profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('') : 'AK'}
              {profile?.avatar_url && (
                <img 
                  src={profile.avatar_url} 
                  alt="User" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
            <div className="hidden xs:flex flex-col items-start leading-none">
              <span className="text-[10px] font-bold tracking-tight text-foreground/90">{profile?.full_name || 'Artkey Architect'}</span>
              <div className="flex items-center gap-1">
                {profile?.role === 'Admin' ? (
                  <div className="flex items-center gap-0.5 px-1 rounded-sm bg-violet-500/10 text-violet-400 border border-violet-500/10">
                    <Shield size={6} strokeWidth={3} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Admin</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 px-1 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                    <UserIcon size={6} strokeWidth={3} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Member</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card/90 backdrop-blur-3xl border-white/10 rounded-2xl p-2 shadow-2xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 py-2">
              {profile?.full_name || 'Artkey Architect'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5 mx-1" />
            <DropdownMenuItem onClick={() => router.push('/settings')} className="rounded-xl px-3 py-2 cursor-pointer focus:bg-primary/10 transition-all">
              <span className="text-sm font-medium tracking-tight">Profile Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="bg-white/5 mx-1" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="rounded-xl px-3 py-2 cursor-pointer focus:bg-rose-500/10 text-rose-500 transition-all"
          >
            <span className="text-sm font-bold tracking-tight text-rose-600">Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
