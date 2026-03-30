'use client';

import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleCard } from '@/components/ScheduleCard';
import { cn } from '@/lib/utils';

// --- Types ---
interface Assignment {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  status: string;
  due_date: string;
}

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  priority: 'High' | 'Medium' | 'Low';
  recurrence_type: 'Daily' | 'Weekly' | 'Monthly';
  trigger_time: string;
  is_paused: boolean;
}

interface DayOverviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  allAssignments: Assignment[];
  relevantSchedules: Schedule[];
  onTogglePause: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onAssignmentClick: (id: string) => void;
  isAdmin?: boolean;
}

export function DayOverviewModal({
  open,
  onOpenChange,
  selectedDate,
  allAssignments,
  relevantSchedules,
  onTogglePause,
  onDelete,
  onAssignmentClick,
  isAdmin,
}: DayOverviewModalProps) {
  
  const todaysAssignments = allAssignments.filter(a => isSameDay(new Date(a.due_date), selectedDate));

  // Helpers for ScheduleCard
  function formatRecurrenceRule(s: Schedule) {
    const time = s.trigger_time?.slice(0, 5) || '12:00';
    if (s.recurrence_type === 'Daily') return `Every day at ${time}`;
    if (s.recurrence_type === 'Weekly') return `Weekly trigger at ${time}`;
    if (s.recurrence_type === 'Monthly') return `Monthly trigger at ${time}`;
    return '';
  }

  function calculateNextRun(s: Schedule) {
    // Simplified for modal display
    return `${s.trigger_time?.slice(0, 5)} (Today)`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/60 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden gap-0 rounded-[32px] sm:rounded-none">
        <DialogHeader className="px-6 py-5 border-b border-white/5 bg-white/5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center justify-between w-full">
            <span>{format(selectedDate, 'MMMM d, yyyy')}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 overflow-y-auto max-h-[75vh] no-scrollbar flex flex-col gap-8">
          
          <AnimatePresence mode="popLayout" initial={false}>
            {todaysAssignments.length === 0 && relevantSchedules.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]"
              >
                <p className="text-sm text-muted-foreground tracking-tight italic font-medium">
                  No active cycles on this date.
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* --- Assignments Section --- */}
                {todaysAssignments.length > 0 && (
                   <div className="flex flex-col gap-4">
                     <h3 className="text-[11px] font-bold tracking-widest text-muted-foreground/50 uppercase">
                       Target Deliveries
                     </h3>
                     <div className="flex flex-col gap-3">
                      {todaysAssignments.map((a, idx) => (
                         <motion.button
                           key={a.id}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           onClick={() => onAssignmentClick(a.id)}
                           className={cn(
                             "w-full text-left p-5 rounded-[24px] bg-white/[0.04] border border-white/5 hover:bg-white/10 transition-all flex flex-col gap-2.5",
                             a.priority === 'High' ? "shadow-[0_4px_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20" : 
                             a.priority === 'Medium' ? "shadow-[0_4px_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20" : 
                             "shadow-[0_4px_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20"
                           )}
                         >
                            <div className="flex justify-between items-start">
                              <span className="text-lg font-bold tracking-tight leading-tight text-foreground line-clamp-2">
                                {a.title}
                              </span>
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1.5",
                                a.priority === 'High' ? "bg-rose-500" : a.priority === 'Medium' ? "bg-amber-500" : "bg-emerald-500"
                              )} />
                            </div>
                            <div className="flex items-center gap-3 mt-1 underline underline-offset-4 decoration-border">
                               <span className="text-[11px] font-bold text-muted-foreground/80 tracking-widest uppercase">
                                 {a.status}
                               </span>
                            </div>
                         </motion.button>
                       ))}
                     </div>
                   </div>
                )}

                {/* --- Recurring Schedules Section --- */}
                {relevantSchedules.length > 0 && (
                   <div className="flex flex-col gap-4">
                      <h3 className="text-[11px] font-bold tracking-widest text-muted-foreground/50 uppercase">
                        Recurring Cycles
                      </h3>
                      <div className="flex flex-col gap-4">
                         {relevantSchedules.map((s, idx) => (
                           <motion.div 
                             key={s.id}
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: (todaysAssignments.length + idx) * 0.05 }}
                           >
                              <ScheduleCard 
                                  schedule={s}
                                onTogglePause={onTogglePause}
                                onDelete={onDelete}
                                recurrenceRule={formatRecurrenceRule(s)}
                                nextRun={calculateNextRun(s)}
                                isAdmin={isAdmin}
                              />
                           </motion.div>
                         ))}
                      </div>
                   </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
