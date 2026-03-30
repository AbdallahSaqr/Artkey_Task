'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

interface PendingAssignmentJSON {
  intent: 'create_task' | 'insufficient_info';
  title?: string;
  description?: string;
  recurrence_type?: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  trigger_time?: string;
  priority?: 'Low' | 'Medium' | 'High';
  response?: string;
}

export function AIAssistantSheet({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I can help you create tasks and schedules. What do you need done?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignmentJSON | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, pendingAssignment]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setChatHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessage },
    ]);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = chatHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'API communication error');
      }

      const data: PendingAssignmentJSON = await res.json();

      if (data.intent === 'insufficient_info') {
        setChatHistory((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.response || "I need a bit more context. What is the title and schedule for this task?",
          },
        ]);
      } else if (data.intent === 'create_task') {
        setPendingAssignment(data);
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'API communication error';
      toast.error(`AI Assistant: ${errorMessage}`);
      setChatHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I encountered an error: ${errorMessage}. Please check your API key or try again later.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmCreate() {
    if (!pendingAssignment) return;
    setIsLoading(true);
    let createdAssignmentId: string | null = null;

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Authentication required to create assignments.');

      const { title, description, recurrence_type, trigger_time, priority } = pendingAssignment;

      let error;
      
      if (recurrence_type && recurrence_type !== 'None') {
        const run_hour = trigger_time ? parseInt(trigger_time.split(':')[0], 10) : 0;
        
        const res = await supabase.from('schedules').insert({
          title,
          description: description || '',
          priority: priority || 'Medium',
          recurrence_type: recurrence_type.toLowerCase(),
          run_hour,
          is_paused: false,
        });
        error = res.error;
      } else {
        // Use the AI-extracted due_date, or default to 7 days from now
        const dueDate = (pendingAssignment as any).due_date
          ? new Date((pendingAssignment as any).due_date + 'T' + (trigger_time || '09:00') + ':00').toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const res = await supabase.from('assignments').insert({
          title,
          description: description || '',
          priority: priority || 'Medium',
          status: 'Pending',
          due_date: dueDate,
          created_by: user.id,
        }).select('id').single();
        error = res.error;
        createdAssignmentId = res.data?.id || null;

        if (!error && res.data?.id) {
          const { error: linkError } = await supabase.from('assignment_assignees').insert({
            assignment_id: res.data.id,
            user_id: user.id,
          });

          if (linkError) throw linkError;
        }
      }

      if (error) throw error;

      toast.success(
        recurrence_type && recurrence_type !== 'None'
          ? 'Recurring schedule successfully created.'
          : 'Assignment successfully created.'
      );
      
      setPendingAssignment(null);
      setChatHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Success! I've created "${title}" for you. What's next?`,
        },
      ]);
    } catch (error: any) {
      if (createdAssignmentId) {
        await createClient().from('assignments').delete().eq('id', createdAssignmentId);
      }
      console.error('Task creation exception:', error);
      toast.error(error.message || 'Database error occurred while resolving task request.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {children && <SheetTrigger render={children as React.ReactElement} />}
      
      <SheetContent
        className="
          w-full sm:max-w-lg 
          flex flex-col h-full
          bg-background/80 backdrop-blur-xl border-l border-white/10
          shadow-[-10px_0_40px_rgba(0,0,0,0.1)] p-0
        "
      >
        <SheetHeader className="p-6 pb-4 border-b border-white/10 shrink-0">
          <SheetTitle className="flex items-center gap-3 text-primary font-bold tracking-tight">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            Artkey AI Assistant
          </SheetTitle>
        </SheetHeader>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5 min-h-0 no-scrollbar">
          <AnimatePresence initial={false}>
            {chatHistory.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 400, 
                  damping: 28,
                  delay: Math.min(idx * 0.05, 0.3)
                }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-5 py-3 rounded-2xl text-[14px] leading-relaxed tracking-tight shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted/50 backdrop-blur-md text-foreground border border-border/50 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isLoading && !pendingAssignment && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-start"
              >
                <div className="px-5 py-3 bg-muted/50 backdrop-blur-md rounded-2xl border border-border/50 rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                </div>
              </motion.div>
            )}

            {/* Human-in-the-Loop Intercept Card */}
            {pendingAssignment && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="pt-2"
              >
                <Card className="bg-card/40 backdrop-blur-xl border border-white/10 shadow-xl mx-0 rounded-3xl overflow-hidden">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-[15px] font-bold tracking-tight leading-tight">
                      Confirm Assignment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 text-[13px] gap-3 flex flex-col text-muted-foreground/80">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl">
                      <span className="font-bold text-foreground">Title</span>
                      <span className="text-right ml-4 font-medium truncate">{pendingAssignment.title}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl">
                      <span className="font-bold text-foreground">Cycle</span>
                      <span className="text-right ml-4 font-bold text-primary">
                        {pendingAssignment.recurrence_type} 
                        {pendingAssignment.recurrence_type !== 'None' && pendingAssignment.trigger_time ? ` @ ${pendingAssignment.trigger_time}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl">
                      <span className="font-bold text-foreground">Priority</span>
                      <span className={cn(
                        "text-right px-2 py-0.5 rounded-full text-[10px] font-bold",
                        pendingAssignment.priority === 'High' ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                      )}>{pendingAssignment.priority}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 flex gap-3 w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-xl text-muted-foreground hover:text-foreground"
                      onClick={() => setPendingAssignment(null)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 rounded-xl shadow-lg shadow-primary/20"
                      onClick={confirmCreate}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Create"}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} className="h-4 shrink-0" />
        </div>

        {/* Input Dock */}
        <div className="shrink-0 p-6">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 bg-muted p-2 rounded-full border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-lg"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || pendingAssignment !== null}
              placeholder={pendingAssignment ? "Waiting for confirmation..." : "How can I help you today?"}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-5 flex-1 text-sm h-11"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || pendingAssignment !== null}
              className="rounded-full shrink-0 w-10 h-10 shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <Send size={16} />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
