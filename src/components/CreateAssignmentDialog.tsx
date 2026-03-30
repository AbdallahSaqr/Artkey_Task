'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, X, Users, Tag, BookOpen, ChevronDown } from 'lucide-react';
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

const assignmentSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']),
  due_date: z.string().min(1, 'Due date is required.'),
  template_id: z.string().optional(),
});

type FormValues = z.infer<typeof assignmentSchema>;

export function CreateAssignmentDialog({ children, onSuccess }: { children: React.ReactNode, onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(['Urgent', 'Research', 'Creative', 'Technical', 'Quality']);
  
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const supabase = createClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { title: '', description: '', priority: 'Medium', due_date: '', template_id: '' },
  });

  useEffect(() => {
    if (open) {
      fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchInitialData() {
    try {
      const [templRes, usersRes] = await Promise.all([
        supabase.from('assignment_templates').select('*'),
        supabase.from('profiles').select('id, full_name, role') // Assuming profiles table for users
      ]);
      if (templRes.data) setTemplates(templRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (e) {
      console.error('Data fetch error:', e);
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue('title', template.title);
      form.setValue('description', template.description);
      form.setValue('priority', template.priority);
      toast.info(`Applied template: ${template.name || template.title}`);
    }
  }

  const toggleAssignee = (id: string) => {
    setSelectedAssignees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags(prev => [...prev, t]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    let createdAssignmentId: string | null = null;
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Authentication required to create assignments.');

      // 1. Create main assignment
      const { data: newAssignment, error } = await supabase
        .from('assignments')
        .insert({
          title: data.title,
          description: data.description,
          priority: data.priority,
          due_date: data.due_date,
          status: 'Pending',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      createdAssignmentId = newAssignment.id;

      // 2. Handle Junction Tables (Assignees & Tags)
      const assigneeIds = selectedAssignees.length > 0 ? selectedAssignees : [user.id];

      const { error: assigneeLinkError } = await supabase.from('assignment_assignees').insert(
        assigneeIds.map(userId => ({ assignment_id: newAssignment.id, user_id: userId }))
      );

      if (assigneeLinkError) throw assigneeLinkError;

      const junctionOps = [];
      if (selectedTags.length > 0) {
        junctionOps.push(supabase.from('assignment_tags').insert(
          selectedTags.map(tagName => ({ assignment_id: newAssignment.id, tag_name: tagName }))
        ));
      }

      await Promise.all(junctionOps);

      // Notification logic
      await supabase.from('notifications').insert({
        title: 'Assignment Created',
        message: `The assignment "${data.title}" was established with ${assigneeIds.length} assignees and ${selectedTags.length} tags.`,
        is_read: false
      });

      toast.success('Assignment fully initialized.');
      form.reset();
      setSelectedAssignees([]);
      setSelectedTags([]);
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      if (createdAssignmentId) {
        await supabase.from('assignments').delete().eq('id', createdAssignmentId);
      }
      toast.error(error.message || 'Initialization failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      
      <DialogContent className="sm:max-w-2xl bg-card/60 backdrop-blur-2xl border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-5 border-b border-white/5 bg-white/5 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plus className="text-primary" size={20} /> Initialize Assignment
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {/* Template Selector */}
              <div className="space-y-2">
                <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                  <BookOpen size={12} /> Standard Templates
                </FormLabel>
                <Select onValueChange={(val: any) => val && applyTemplate(val)}>
                   <SelectTrigger className="bg-background/40 border-white/10 rounded-2xl h-10 transition-all hover:bg-background/60">
                     <SelectValue placeholder="Load from library..." />
                   </SelectTrigger>
                   <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                     {templates.length > 0 ? templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name || t.title}</SelectItem>
                     )) : (
                        <SelectItem value="none" disabled>No templates found</SelectItem>
                     )}
                   </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Title</FormLabel>
                        <FormControl><Input placeholder="Task name..." {...field} className="bg-background/40 border-white/10 rounded-xl" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-background/40 border-white/10 rounded-xl">
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="due_date"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Due Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} className="bg-background/40 border-white/10 rounded-xl [color-scheme:dark]" />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Description</FormLabel>
                        <FormControl><Textarea placeholder="Scope details..." {...field} className="bg-background/40 border-white/10 rounded-xl h-24 resize-none" /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                  {/* Multi-Assignee (Requirement 01) */}
                  <div className="space-y-3">
                    <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                      <Users size={12} /> Assignees (Multi)
                    </FormLabel>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                      {users.length > 0 ? users.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleAssignee(u.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-[11px] font-medium transition-all",
                            selectedAssignees.includes(u.id) 
                             ? "bg-primary/20 border-primary text-foreground shadow-lg shadow-primary/10" 
                             : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold">
                            {u.full_name?.split(' ').map((n:any) => n[0]).join('') || 'U'}
                          </div>
                          {u.full_name}
                        </button>
                      )) : (
                        <div className="p-4 rounded-2xl bg-white/5 text-[10px] text-center italic text-muted-foreground">Synchronizing team members...</div>
                      )}
                    </div>
                  </div>

                  {/* Creatable Tags (Requirement 01) */}
                  <div className="space-y-3">
                    <FormLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                      <Tag size={12} /> Tags & Categories
                    </FormLabel>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                           <Input 
                             value={newTag} 
                             onChange={(e) => setNewTag(e.target.value)} 
                             onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag(newTag))}
                             placeholder="Add tag..." 
                             className="bg-background/40 border-white/10 rounded-xl h-9 text-xs" 
                           />
                           <Button type="button" onClick={() => addTag(newTag)} variant="secondary" size="sm" className="rounded-xl h-9">Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                           <AnimatePresence>
                             {selectedTags.map(tag => (
                               <motion.span
                                 key={tag}
                                 initial={{ scale: 0.8, opacity: 0 }}
                                 animate={{ scale: 1, opacity: 1 }}
                                 exit={{ scale: 0.8, opacity: 0 }}
                                 className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary shadow-sm"
                               >
                                 {tag}
                                 <X size={10} className="cursor-pointer hover:text-foreground transition-colors" onClick={() => removeTag(tag)} />
                               </motion.span>
                             ))}
                           </AnimatePresence>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                           <span className="text-[9px] text-muted-foreground font-bold uppercase mr-1">Suggestions:</span>
                           {availableTags.filter(t => !selectedTags.includes(t)).map(t => (
                              <button key={t} type="button" onClick={() => addTag(t)} className="text-[9px] font-medium text-muted-foreground hover:text-primary transition-colors">#{t}</button>
                           ))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-white/5 bg-white/5 shrink-0">
               <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-2xl shadow-xl shadow-primary/20 font-bold tracking-tight">
                 {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Initialize Assignment"}
               </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
