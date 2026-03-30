'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// --- Types ---
interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();
    // In a real app, you would set up a Supabase Realtime subscription here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchNotifications() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // Fallback to empty if table doesn't exist yet or other error
        setNotifications([]);
        setUnreadCount(0);
      } else {
        setNotifications(data || []);
        const unread = (data || []).filter((n: Notification) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch (error: any) {
      toast.error('Failed to update notifications.');
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-muted/80 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} className={cn("transition-transform", isOpen && "scale-110")} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background shadow-[0_0_8px_rgba(244,63,94,0.5)]"
              />
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        align="end" 
        sideOffset={8}
        className="w-[320px] sm:w-[380px] p-0 bg-card/60 backdrop-blur-2xl border-white/10 shadow-2xl rounded-3xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-7 px-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10 transition-all"
            >
              <CheckCheck size={12} className="mr-1.5" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
              <p className="text-xs font-medium tracking-tight">Synchronizing alerts...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="p-3 rounded-full bg-muted/20">
                <Inbox size={24} className="text-muted-foreground/30" />
              </div>
              <p className="text-[13px] text-muted-foreground font-medium italic underline-offset-4 decoration-white/5">No alerts found in the cloud.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="flex flex-col">
                {notifications.map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "group relative flex flex-col gap-1 p-5 border-b border-white/5 transition-all hover:bg-white/[0.04] cursor-default",
                      !n.is_read && "bg-primary/[0.03]"
                    )}
                  >
                    {!n.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.4)]" />
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[13px] font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                        {n.title}
                      </span>
                      <time className="text-[10px] tabular-nums font-medium text-muted-foreground/50 whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </time>
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted-foreground tracking-tight line-clamp-2">
                      {n.message}
                    </p>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        <div className="p-3 border-t border-white/5 bg-white/5 flex justify-center">
            <button className="text-[11px] font-bold tracking-widest text-muted-foreground/60 uppercase hover:text-foreground transition-colors py-1">
              View History
            </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
