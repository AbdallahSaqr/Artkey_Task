'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Calendar, Users, Tag, Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const scheduleSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']),
  recurrence_type: z.enum(['Daily', 'Weekly', 'Monthly']),
  trigger_time: z.string().min(5, 'Time is required'),
  days_of_week: z.array(z.number()).optional(),
  dates_of_month: z.array(z.number()).optional(),
});

type FormValues = z.infer<typeof scheduleSchema>;

const DAYS = [
  { label: 'S', value: 0 }, { label: 'M', value: 1 }, { label: 'T', value: 2 },
  { label: 'W', value: 3 }, { label: 'Th', value: 4 }, { label: 'F', value: 5 }, { label: 'S', value: 6 },
];
const DATES = Array.from({ length: 31 }, (_, i) => i + 1);

export function CreateScheduleDialog({ children, onSuccess }: { children: React.ReactNode, onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Automation', 'Recurring']);
  const [newTag, setNewTag] = useState('');

  const supabase = createClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { title: '', description: '', priority: 'Medium', recurrence_type: 'Daily', trigger_time: '09:00', days_of_week: [], dates_of_month: [] },
  });

  const recurrence = form.watch('recurrence_type');
  const watchDays = form.watch('days_of_week') || [];
  const watchDates = form.watch('dates_of_month') || [];

  useEffect(() => {
    if (open) fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchUsers() {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) setUsers(data);
    } catch (e) {
      console.error(e);
    }
  }

  function toggleDay(val: number) {
    const current = form.getValues('days_of_week') || [];
    form.setValue('days_of_week', current.includes(val) ? current.filter(d => d !== val) : [...current, val].sort(), { shouldValidate: true });
  }

  function toggleDate(val: number) {
    const current = form.getValues('dates_of_month') || [];
    form.setValue('dates_of_month', current.includes(val) ? current.filter(d => d !== val) : [...current, val].sort((a,b) => a-b), { shouldValidate: true });
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const run_hour = parseInt(data.trigger_time.split(':')[0], 10);
      const { data: newSched, error } = await supabase
        .from('schedules')
        .insert({
          title: data.title,
          description: data.description || '',
          priority: data.priority,
          recurrence_type: data.recurrence_type,
          trigger_time: `${data.trigger_time}:00`,
          days_of_week: data.recurrence_type === 'Weekly' ? data.days_of_week : null,
          dates_of_month: data.recurrence_type === 'Monthly' ? data.dates_of_month : null,
          is_paused: false,
        })
        .select().single();

      if (error) throw error;

      // Handle junction table for Tags
      if (selectedTags.length > 0) {
        await supabase.from('schedule_tags').insert(
            selectedTags.map(tag => ({ schedule_id: newSched.id, tag_name: tag }))
        );
      }

      await supabase.from('notifications').insert({
        title: 'Schedule Created',
        message: `The automated cycle "${data.title}" was successfully established.`,
        is_read: false
      });

      toast.success('Synchronization cycle established.');
      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || 'Cycle initialization failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      
      <DialogContent className="sm:max-w-2xl bg-card/60 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="px-6 py-5 border-b border-white/5 bg-white/5 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="text-primary" size={20} /> Establish Automated Cycle
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-7 no-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Title</FormLabel>
                        <FormControl><Input placeholder="Cycle name..." {...field} className="bg-background/40 border-white/5 rounded-xl h-10" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recurrence_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Recurrence Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <SelectTrigger className="bg-background/40 border-white/5 rounded-xl h-10"><SelectValue placeholder="Frequency" /></SelectTrigger>
                           <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                             <SelectItem value="Daily">Daily Pulse</SelectItem>
                             <SelectItem value="Weekly">Weekly Checklist</SelectItem>
                             <SelectItem value="Monthly">Monthly Audit</SelectItem>
                           </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <AnimatePresence mode="popLayout">
                    {recurrence === 'Weekly' && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-2">
                            <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Operating Days</FormLabel>
                            <div className="flex items-center justify-between gap-1">
                                {DAYS.map(day => (
                                    <button 
                                        key={day.value} 
                                        type="button" 
                                        onClick={() => toggleDay(day.value)}
                                        className={cn(
                                            "w-8 h-8 rounded-full text-[10px] font-bold transition-all border",
                                            watchDays.includes(day.value) ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
                                        )}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                    {recurrence === 'Monthly' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-2">
                            <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Operating Dates</FormLabel>
                            <div className="grid grid-cols-7 gap-1">
                                {DATES.map(date => (
                                    <button 
                                        key={date} 
                                        type="button" 
                                        onClick={() => toggleDate(date)}
                                        className={cn(
                                            "h-7 rounded-lg text-[9px] font-bold transition-all border",
                                            watchDates.includes(date) ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
                                        )}
                                    >
                                        {date}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                  </AnimatePresence>

                  <FormField
                    control={form.control}
                    name="trigger_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Synchronization Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} className="bg-background/40 border-white/5 rounded-xl h-10 [color-scheme:dark]" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                   <div className="space-y-3">
                     <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                       <Tag size={12} /> Cycle Tags
                     </FormLabel>
                     <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5 min-h-24 content-start">
                        {selectedTags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">
                                {tag}
                                <X size={10} className="ml-1 cursor-pointer hover:text-foreground" onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} />
                            </span>
                        ))}
                        <input 
                            value={newTag} 
                            onChange={(e) => setNewTag(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (newTag && !selectedTags.includes(newTag) && setSelectedTags([...selectedTags, newTag]), setNewTag('')))}
                            placeholder="Add tag..." 
                            className="bg-transparent border-none outline-none text-[10px] font-medium text-foreground ml-1" 
                        />
                     </div>
                   </div>

                   <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Cycle Purpose</FormLabel>
                        <FormControl><Textarea placeholder="Explain automation logic..." {...field} className="bg-background/40 border-white/5 rounded-xl h-32 resize-none" /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-white/5 bg-white/5 shrink-0">
               <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-2xl shadow-xl shadow-primary/20 font-bold tracking-tight">
                 {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Deploy Cycle"}
               </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { X } from 'lucide-react';
