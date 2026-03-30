'use client';

import { motion } from 'framer-motion';
import { Repeat, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  priority: 'High' | 'Medium' | 'Low';
  recurrence_type: string;
  trigger_time: string;
  is_paused: boolean;
}

interface ScheduleCardProps {
  schedule: Schedule;
  onTogglePause: (id: string, currentStatus: boolean) => void;
  onDelete?: (id: string) => void;
  recurrenceRule: string;
  nextRun: string;
  isAdmin?: boolean;
}

export function ScheduleCard({ schedule: s, onTogglePause, onDelete, recurrenceRule, nextRun, isAdmin }: ScheduleCardProps) {
  return (
    <Card className={cn(
      "bg-card/40 backdrop-blur-md border border-border/50 overflow-hidden shadow-xl transition-all hover:bg-card/60 rounded-3xl group",
      s.is_paused && "opacity-50"
    )}>
      <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between space-y-0">
        <div className="flex flex-col gap-1 max-w-[80%]">
          <CardTitle className="text-[14px] font-bold tracking-tight text-foreground line-clamp-1">
            {s.title}
          </CardTitle>
          <CardDescription className="text-[11px] font-bold tracking-tight text-muted-foreground/70 flex items-center gap-1.5">
             <Repeat size={10} className="opacity-50" /> {recurrenceRule}
          </CardDescription>
        </div>
        
        <div className="flex items-center gap-3">
          <Switch 
            checked={!s.is_paused}
            onCheckedChange={() => onTogglePause(s.id, s.is_paused)}
            className="data-[state=checked]:bg-primary"
          />
          {onDelete && isAdmin && (
             <button 
               onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
               title="Delete schedule"
               className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
             </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0">
         <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  s.priority === 'High' ? "bg-rose-400" : s.priority === 'Medium' ? "bg-amber-400" : "bg-emerald-400"
                )} />
                <span className="text-muted-foreground">{s.priority} Priority</span>
              </div>
              <span className="text-primary">{s.is_paused ? 'Paused' : 'Active'}</span>
            </div>

            {!s.is_paused && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/50">Next Trigger</span>
                  <span className="text-[11px] font-bold text-foreground/80">{nextRun}</span>
                </div>
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Clock size={12} />
                </div>
              </div>
            )}
         </div>
      </CardContent>
    </Card>
  );
}
