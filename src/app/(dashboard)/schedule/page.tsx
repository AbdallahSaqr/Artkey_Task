'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getDay,
  getDate,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Repeat, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { AssignmentDetailSheet } from '@/components/AssignmentDetailSheet';
import { DayOverviewModal } from '@/components/DayOverviewModal';
import { Button } from '@/components/ui/button';
import { CreateScheduleDialog } from '@/components/CreateScheduleDialog';
import { ScheduleCard } from '@/components/ScheduleCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCallback } from 'react';
import { useRealtime } from '@/hooks/use-realtime';

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
  days_of_week: number[] | null;
  dates_of_month: number[] | null;
  is_paused: boolean;
}

type ViewType = 'monthly' | 'weekly' | 'daily';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<ViewType>('monthly');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setRole(data.role);
      }
    }
    getRole();
  }, [supabase]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sRes, error: sErr } = await supabase.from('schedules').select('*').order('created_at', { ascending: false });

      if (sErr) throw sErr;

      setSchedules(sRes || []);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setAllAssignments([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role === 'Admin') {
        const { data: aRes, error: aErr } = await supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false });

        if (aErr) throw aErr;
        setAllAssignments((aRes || []) as Assignment[]);
        return;
      }

      const { data: linkRows, error: linksError } = await supabase
        .from('assignment_assignees')
        .select('assignment_id')
        .eq('user_id', user.id);

      if (linksError) throw linksError;

      const assignmentIds = (linkRows || []).map((row: { assignment_id: string }) => row.assignment_id);

      let linkedAssignments: Assignment[] = [];
      if (assignmentIds.length > 0) {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .in('id', assignmentIds);

        if (error) throw error;
        linkedAssignments = (data || []) as Assignment[];
      }

      const deduped = new Map<string, Assignment>();
      [...linkedAssignments].forEach((item) => {
        deduped.set(item.id, item);
      });

      const scopedAssignments = Array.from(deduped.values()).sort((a, b) => {
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      });

      setAllAssignments(scopedAssignments);
    } catch (error: any) {
      console.error(error);
      const msg = String(error?.message || '').toLowerCase();
      const permissionIssue = msg.includes('permission') || msg.includes('row-level security') || msg.includes('assignment_assignees');
      toast.error(permissionIssue ? 'Access policy error: unable to read assignment links. Check Supabase RLS for assignment_assignees.' : 'Failed to load project synchronization data.');
      setAllAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Real-time listeners
  useRealtime('schedules', fetchData);
  useRealtime('assignments', fetchData);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [fetchData]);

  // --- Date Computation Helpers ---
  const calendarDays = useMemo(() => {
    if (calendarView === 'monthly') {
      const start = startOfWeek(startOfMonth(currentDate));
      const end = endOfWeek(endOfMonth(currentDate));
      return eachDayOfInterval({ start, end });
    } else if (calendarView === 'weekly') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    }
    return [currentDate];
  }, [currentDate, calendarView]);

  function getSchedulesForDay(date: Date) {
    return schedules.filter(s => {
      const dayOfWeek = getDay(date);
      const dateOfMonth = getDate(date);
      if (s.recurrence_type === 'Daily') return true;
      if (s.recurrence_type === 'Weekly' && s.days_of_week?.includes(dayOfWeek)) return true;
      if (s.recurrence_type === 'Monthly' && s.dates_of_month?.includes(dateOfMonth)) return true;
      return false;
    });
  }

  // Active schedules for selected date
  const filteredSchedules = useMemo(() => getSchedulesForDay(selectedDate), [schedules, selectedDate]);

  // --- DB Operations ---
  async function togglePause(id: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    try {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_paused: newStatus } : s));
      const { error } = await supabase.from('schedules').update({ is_paused: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Schedule ${newStatus ? 'paused' : 'resumed'} successfully.`);
    } catch (error: any) {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_paused: currentStatus } : s));
      toast.error(error.message || 'Failed to update schedule status.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you certain you wish to dismantle this automated cycle?')) return;
    try {
      setSchedules(prev => prev.filter(s => s.id !== id));
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Schedule dismantled successfully.');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete schedule.');
      fetchData();
    }
  }

  // --- UI Formatting Helpers ---
  function formatRecurrenceRule(s: Schedule) {
    const time = s.trigger_time?.slice(0, 5) || '12:00';
    if (s.recurrence_type === 'Daily') return `Every day at ${time}`;
    if (s.recurrence_type === 'Weekly') {
      const daysStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const activeDays = (s.days_of_week || []).map(d => daysStr[d]).join(', ');
      return `Weekly on ${activeDays || 'None'} at ${time}`;
    }
    if (s.recurrence_type === 'Monthly') {
      const dates = (s.dates_of_month || []).join(', ');
      return `Monthly on the ${dates || 'None'} at ${time}`;
    }
    return '';
  }

  function calculateNextRun(s: Schedule) {
    const now = new Date();
    const timeStr = s.trigger_time?.slice(0, 5) || '09:00';
    const [h, m] = timeStr.split(':').map(Number);
    let next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next < now) next.setDate(next.getDate() + 1);
    return format(next, 'MMM d, h:mm a');
  }

  // --- Grid Click Logic ---
  function handleDayClick(date: Date) {
    setSelectedDate(date);
    // Responsive Logic: width < 768px (md breakpoint) opens modal
    if (window.innerWidth < 768) {
      setModalOpen(true);
    }
  }

  const handleNext = () => {
    if (calendarView === 'monthly') setCurrentDate(addMonths(currentDate, 1));
    else if (calendarView === 'weekly') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handlePrev = () => {
    if (calendarView === 'monthly') setCurrentDate(subMonths(currentDate, 1));
    else if (calendarView === 'weekly') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initialising Timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto p-4 md:p-6 min-h-full pb-40 no-scrollbar">
      
      {/* ── Calendar Section ────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="flex-1 flex flex-col gap-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Schedules</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 tracking-tight">Active tasks timeline and recurring triggers.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select 
  value={calendarView} 
  onValueChange={(v) => {
    if (v) setCalendarView(v as ViewType);
  }}
>
              <SelectTrigger className="w-[120px] bg-card/40 border-border rounded-xl h-9 text-xs font-semibold">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="bg-card/95 backdrop-blur-xl border-border">
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>

            <CreateScheduleDialog>
              <Button className="h-9 px-4 rounded-xl gap-2 font-medium tracking-tight text-xs">
                <Plus size={15}/> New Schedule
              </Button>
            </CreateScheduleDialog>
          </div>
        </div>

        <div className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-border bg-muted/20">
            <h2 className="text-base md:text-lg font-bold tracking-tight text-foreground/90">
              {calendarView === 'monthly' ? format(currentDate, 'MMMM yyyy') : 
               calendarView === 'weekly' ? `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}` :
               format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-full border-border bg-transparent hover:bg-muted text-muted-foreground transition-all">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8 rounded-full border-border bg-transparent hover:bg-muted text-muted-foreground transition-all">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar relative min-h-0">
            <AnimatePresence mode="wait" initial={false}>
              {calendarView === 'monthly' && (
                <motion.div
                  key="monthly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col h-full"
                >
                  <div className="hidden sm:grid grid-cols-7 border-b border-border/50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center py-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 select-none">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-7 flex-1 auto-rows-fr bg-muted/10">
                    {calendarDays.map((date) => {
                      const daySchedules = getSchedulesForDay(date);
                      const isCurrentMonth = isSameMonth(date, startOfMonth(currentDate));
                      const isSelected = isSameDay(date, selectedDate);
                      return (
                        <div 
                          key={date.toString()} 
                          onClick={() => handleDayClick(date)}
                          className={cn(
                            "min-h-[80px] sm:min-h-[100px] border-r border-b border-border/40 p-2 flex flex-col gap-1.5 hover:bg-primary/[0.03] transition-colors relative group cursor-pointer overflow-hidden",
                            !isCurrentMonth && "opacity-25",
                            isSelected && "bg-primary/[0.05] ring-inset ring-1 ring-primary/20"
                          )}
                        >
                          <span className={cn(
                            "w-6 h-6 flex items-center justify-center text-[11px] font-bold rounded-full sm:ml-auto select-none",
                            isToday(date) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : (isSelected ? "text-primary" : "text-muted-foreground/60")
                          )}>
                            {format(date, 'd')}
                          </span>
                          <div className="flex flex-col gap-1 pr-1 min-w-0">
                            {daySchedules.slice(0, 3).map((s, idx) => (
                              <div key={`${s.id}-${idx}`} className={cn(
                                "px-1.5 py-0.5 text-[9px] truncate w-full rounded-md border font-bold tracking-tight block",
                                s.is_paused ? "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" : 
                                (s.priority === 'High' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")
                              )}>
                                {s.title}
                              </div>
                            ))}
                            {daySchedules.length > 3 && <div className="text-[9px] font-bold text-muted-foreground/60 px-1">+{daySchedules.length - 3} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {calendarView === 'weekly' && (
                <motion.div
                  key="weekly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col h-full bg-muted/10"
                >
                  <div className="grid grid-cols-7 border-b border-border/50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center py-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 flex-1">
                    {calendarDays.map((date) => {
                      const daySchedules = getSchedulesForDay(date);
                      const isSelected = isSameDay(date, selectedDate);
                      return (
                        <div 
                          key={date.toString()} 
                          onClick={() => handleDayClick(date)}
                          className={cn(
                            "min-h-[400px] border-r border-border/40 p-3 flex flex-col gap-4 hover:bg-primary/[0.03] transition-colors cursor-pointer",
                            isSelected && "bg-primary/[0.05] ring-inset ring-1 ring-primary/20",
                            isToday(date) && "bg-primary/[0.02]"
                          )}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                             <span className="text-[10px] uppercase font-bold text-muted-foreground/40">{format(date, 'MMM')}</span>
                             <span className={cn(
                               "w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full",
                               isToday(date) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : (isSelected ? "text-primary" : "text-foreground/80")
                             )}>
                               {format(date, 'd')}
                             </span>
                          </div>
                          <div className="flex flex-col gap-2">
                             {daySchedules.map((s, idx) => (
                               <div key={`${s.id}-${idx}`} className={cn(
                                 "p-2.5 rounded-2xl border text-[10px] font-bold shadow-sm leading-[1.3] transition-transform hover:scale-[1.02]",
                                 s.is_paused ? "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" : 
                                 (s.priority === 'High' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")
                               )}>
                                 <span className="block opacity-50 mb-1">{s.trigger_time?.slice(0,5)}</span>
                                 {s.title}
                               </div>
                             ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {calendarView === 'daily' && (
                <motion.div
                  key="daily"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col h-full bg-muted/10 p-6"
                >
                  <div className="max-w-2xl mx-auto w-full space-y-4">
                    {HOURS.map((hour) => {
                      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                      const daySchedules = getSchedulesForDay(selectedDate).filter(s => parseInt(s.trigger_time?.split(':')[0] || '0', 10) === hour);
                      return (
                        <div key={hour} className="group flex gap-8 min-h-[60px]">
                           <div className="w-12 pt-1 text-[11px] font-bold text-muted-foreground/30 tabular-nums">{hourStr}</div>
                           <div className="flex-1 border-t border-border/50 relative pt-3 group-hover:border-primary/40 transition-colors">
                              <div className="flex flex-col gap-2.5">
                                 {daySchedules.map((s, idx) => (
                                   <div key={`${s.id}-${idx}`} className={cn(
                                     "flex items-center justify-between p-4 rounded-3xl border shadow-sm transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer",
                                     s.is_paused ? "bg-zinc-500/10 border-zinc-500/20" : 
                                     (s.priority === 'High' ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20")
                                   )}>
                                     <div className="flex items-center gap-4">
                                        <div className={cn("w-2 h-2 rounded-full", s.is_paused ? "bg-zinc-400" : (s.priority === 'High' ? "bg-rose-400" : "bg-emerald-400"))} />
                                        <span className="text-[15px] font-bold tracking-tight text-foreground/90">{s.title}</span>
                                     </div>
                                     <span className="text-[11px] font-bold text-muted-foreground/50 tabular-nums">{s.trigger_time?.slice(0,5)}</span>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── Management Sidebar ── */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 25, delay: 0.1 }}
        className="hidden md:flex lg:w-[380px] shrink-0 flex-col gap-6"
      >
        <div className="flex flex-col gap-1.5 h-10 mt-1">
           <h2 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Day Management Console</h2>
           <p className="text-[10px] font-medium text-primary tracking-tight">{format(selectedDate, 'EEEE, MMM do')}</p>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar pb-10">
          {loading ? (
             <div className="text-sm text-muted-foreground text-center py-10 animate-pulse font-medium">Synchronizing...</div>
          ) : filteredSchedules.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 px-6 border-2 border-dashed border-border/40 rounded-[32px] bg-muted/5">
                <Clock size={24} className="text-muted-foreground/30 mb-3" />
                <p className="text-[13px] text-muted-foreground font-medium text-center leading-relaxed">No recurring cycles detected for this specific day.</p>
             </div>
          ) : (
             <AnimatePresence mode="popLayout" initial={false}>
               {filteredSchedules.map((s) => (
                 <motion.div
                   layout
                   key={s.id}
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: -10 }}
                   transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                 >
                   <ScheduleCard 
                      schedule={s} 
                      onTogglePause={togglePause}
                      onDelete={handleDelete}
                      recurrenceRule={formatRecurrenceRule(s)}
                      nextRun={calculateNextRun(s)} isAdmin={role === 'Admin'}
                    />
                 </motion.div>
               ))}
             </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* ── Overlays ── */}
      <DayOverviewModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        selectedDate={selectedDate}
        allAssignments={allAssignments}
        relevantSchedules={filteredSchedules}
        onTogglePause={togglePause}
        onDelete={handleDelete}
        isAdmin={role === 'Admin'}
        onAssignmentClick={(id) => {
          setDetailId(id);
          setDetailOpen(true);
        }}
      />
      
      <AssignmentDetailSheet 
        assignmentId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
