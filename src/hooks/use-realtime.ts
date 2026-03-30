'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtime(table: string, callback: () => void) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback, supabase]);
}
