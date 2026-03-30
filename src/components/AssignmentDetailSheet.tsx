'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { Calendar, User, Info, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MOCK_ASSIGNMENTS, MOCK_HISTORY } from '@/lib/mocks';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  due_date: string;
  assignee?: string;
  tags?: string[];
}

interface ActivityLog {
  id: string;
  assignment_id: string;
  action_type: string;
  previous_value: string | null;
  new_value: string;
  user_id?: string;
  profiles?: { full_name: string } | null;
  created_at: string;
}

interface Props {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
  onDelete?: () => void;
}

export function AssignmentDetailSheet({ assignmentId, open, onOpenChange, onStatusChange, onDelete }: Props) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open && assignmentId) {
      fetchDetails(assignmentId);
    } else if (!open) {
      // Clean up for smooth transition
      setTimeout(() => {
        setAssignment(null);
        setAssignees([]);
        setLogs([]);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignmentId]);

  async function fetchDetails(id: string) {
    setIsLoading(true);

    // --- Mock Data Handling ---
    if (id.startsWith('mock-')) {
      const mockObj = MOCK_ASSIGNMENTS.find(a => a.id === id);
      if (mockObj) {
        setAssignment(mockObj as Assignment);
        setLogs((MOCK_HISTORY as any)[id] || []);
        setIsLoading(false);
        return;
      }
    }

    try {
      const [assignmentRes, logsRes, assigneesRes] = await Promise.all([
        supabase.from('assignments').select('*').eq('id', id).single(),
        supabase.from('assignment_activity_logs')
          .select('*, profiles!assignment_activity_logs_user_id_fkey(full_name)')
          .eq('assignment_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('assignment_assignees')
          .select('profiles!assignment_assignees_user_id_fkey(full_name)')
          .eq('assignment_id', id),
      ]);

      if (assignmentRes.error) throw assignmentRes.error;
      setAssignment(assignmentRes.data as Assignment);

      if (assigneesRes.data) {
        const names = assigneesRes.data
          .map((r: any) => r.profiles?.full_name as string)
          .filter(Boolean);
        setAssignees(names);
      } else {
        setAssignees([]);
      }
      
      if (logsRes.error) {
        console.warn('Logs fetch ignored:', logsRes.error);
        setLogs([]);
      } else {
        setLogs(logsRes.data as ActivityLog[]);
      }
    } catch (error: any) {
      toast.error('Failed to load assignment details.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(value: string | null) {
    if (!value || !assignment) return;
    const newStatus = value as Assignment['status'];
    if (assignment.status === newStatus) return;

    const oldStatus = assignment.status;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    let userName = 'Unknown';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      if (profile?.full_name) userName = profile.full_name;
    }

    // Optimistic UI mutation
    setAssignment({ ...assignment, status: newStatus });
    
    const optimisticLog: ActivityLog = {
      id: Math.random().toString(),
      assignment_id: assignment.id,
      action_type: 'status_change',
      previous_value: oldStatus,
      new_value: newStatus,
      user_id: user?.id,
      profiles: { full_name: userName },
      created_at: new Date().toISOString(),
    };
    
    setLogs(prev => [...prev, optimisticLog]);

    // Skip DB for mocks
    if (assignment.id.startsWith('mock-')) {
      toast.success(`Status updated to ${newStatus} (Mock)`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignment.id);
        
      if (updateError) throw updateError;
      
      await supabase
        .from('assignment_activity_logs')
        .insert({
          assignment_id: assignment.id,
          action_type: 'status_change',
          previous_value: oldStatus,
          new_value: newStatus,
          user_id: user?.id || null,
        });

      await supabase.from('notifications').insert({
        title: 'Status Updated',
        message: `The assignment "${assignment.title}" is now ${newStatus}.`,
        is_read: false
      });
      
      toast.success(`Status updated to ${newStatus}`);
      onStatusChange?.();
    } catch (error: any) {
      setAssignment({ ...assignment, status: oldStatus });
      setLogs(prev => prev.filter((l) => l.id !== optimisticLog.id));
      toast.error('Failed to update status.');
    }
  }

  async function handleDelete() {
    if (!assignment) return;
    if (!confirm(`Are you sure you want to delete "${assignment.title}"?`)) return;

    if (assignment.id.startsWith('mock-')) {
      toast.success('Assignment deleted (Mock)');
      onOpenChange(false);
      onDelete?.();
      return;
    }

    try {
      const { error } = await supabase.from('assignments').delete().eq('id', assignment.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        title: 'Assignment Deleted',
        message: `The assignment "${assignment.title}" was removed.`,
        is_read: false,
      });

      toast.success('Assignment deleted successfully.');
      onOpenChange(false);
      onDelete?.();
      onStatusChange?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete assignment.');
    }
  }

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring' as const, damping: 25 } }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-md flex flex-col h-full bg-background/80 backdrop-blur-xl border-l border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.1)] p-0"
      >
        <SheetHeader className="p-6 pb-4 border-b border-white/10 shrink-0">
          <SheetTitle className="text-xl font-bold tracking-tight text-foreground -mb-1">
            Assignment Profile
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto w-full no-scrollbar">
          {isLoading ? (
             <div className="p-6 flex flex-col gap-8 animate-pulse">
               <div className="space-y-4">
                 <div className="h-8 bg-white/5 rounded-xl w-3/4" />
                 <div className="h-24 bg-white/5 rounded-2xl w-full" />
               </div>
               <div className="space-y-3">
                 <div className="h-4 bg-white/5 rounded-lg w-1/4" />
                 <div className="h-11 bg-white/5 rounded-xl w-full" />
               </div>
               <div className="space-y-6 pl-6 relative before:absolute before:inset-0 before:ml-[9px] before:w-[2px] before:bg-white/5">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="space-y-2 relative">
                     <div className="absolute -left-[32px] mt-1 h-3 w-3 rounded-full bg-white/5" />
                     <div className="h-3 bg-white/5 rounded-lg w-full" />
                     <div className="h-2 bg-white/5 rounded-lg w-1/2" />
                   </div>
                 ))}
               </div>
             </div>
          ) : assignment ? (
             <div className="p-6 flex flex-col gap-8">
               <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4">
                     <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
                       {assignment.title}
                     </h2>
                     <span className={cn(
                       "px-2.5 py-1 text-[11px] rounded-full border font-medium tracking-tight shrink-0",
                       assignment.priority === 'High' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                       assignment.priority === 'Medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                     )}>
                       {assignment.priority}
                     </span>
                  </div>

                  {assignment.description && (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {assignment.description}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                     {assignees.length > 0 ? assignees.map((name, i) => (
                       <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-white/10 rounded-full text-xs font-medium text-muted-foreground tracking-tight">
                         <User size={13} className="shrink-0" /> {name}
                       </div>
                     )) : (
                       <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-white/10 rounded-full text-xs font-medium text-muted-foreground tracking-tight">
                         <User size={13} className="shrink-0" /> {assignment.assignee || 'Unassigned'}
                       </div>
                     )}
                     <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/50 border border-white/10 rounded-full text-xs font-medium text-muted-foreground tracking-tight">
                       <Calendar size={13} className="shrink-0" /> 
                       {assignment.due_date ? format(new Date(assignment.due_date), 'MMM d, yyyy') : 'No Date'}
                     </div>
                  </div>
               </div>

               <div className="flex flex-col gap-2">
                 <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/80">
                   Active Status
                 </h3>
                 <Select value={assignment.status} onValueChange={handleStatusChange}>
                   <SelectTrigger className="w-full h-11 bg-white/[0.03] border-white/10 ring-offset-background focus:ring-primary/50 text-foreground font-medium tracking-tight rounded-xl">
                     <SelectValue placeholder="Select a status" />
                   </SelectTrigger>
                   <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl">
                     <SelectItem value="Pending">Pending</SelectItem>
                     <SelectItem value="In Progress">In Progress</SelectItem>
                     <SelectItem value="Completed">Completed</SelectItem>
                     <SelectItem value="Overdue">Overdue</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

               <div className="flex flex-col gap-5 pt-4">
                 <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/80">
                   Activity Timeline
                 </h3>
                 
                 {logs.length === 0 ? (
                   <p className="text-sm text-muted-foreground tracking-tight mt-1 ml-2 italic underline-offset-4 decoration-white/5">No activity recorded yet.</p>
                 ) : (
                   <motion.div 
                     variants={containerVariants}
                     initial="hidden"
                     animate="visible"
                     className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[9px] before:w-[2px] before:bg-white/10 before:-z-10"
                   >
                     {logs.map((log) => (
                       <motion.div key={log.id} variants={itemVariants} className="relative">
                         <div className="absolute -left-[32px] mt-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                         
                         <div className="flex flex-col gap-1">
                           <p className="text-[13px] leading-snug tracking-tight text-foreground">
                             {log.action_type === 'status_change' ? (
                               <>
                                 Status changed from <span className="font-semibold">{log.previous_value || 'None'}</span> to <span className="font-semibold text-primary">{log.new_value}</span>
                               </>
                             ) : (
                               <>{log.action_type}</>
                             )}
                             <span className="text-muted-foreground/60 ml-1.5 text-[11px]">by {log.profiles?.full_name || 'System'}</span>
                           </p>
                           <time className="text-[11px] font-medium tracking-tight text-muted-foreground/70">
                             {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                           </time>
                         </div>
                       </motion.div>
                     ))}
                   </motion.div>
                 )}
               </div>

               <div className="pt-2">
                 <Button
                   variant="ghost"
                   onClick={handleDelete}
                   className="w-full h-11 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 gap-2 font-medium tracking-tight text-sm cursor-pointer"
                 >
                   <Trash2 size={15} />
                   Delete Assignment
                 </Button>
               </div>
             </div>
          ) : (
             <div className="flex justify-center items-center h-48 text-muted-foreground text-sm tracking-tight italic">
               Assignment not found.
             </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
