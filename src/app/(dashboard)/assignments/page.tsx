'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { AssignmentTable } from '@/components/assignments/assignment-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { createClient } from '@/lib/supabase/client';
import { useRealtime } from '@/hooks/use-realtime';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const supabase = createClient();

  async function withAssigneesFromJunction(rows: any[]) {
    if (!rows.length) return rows;

    const ids = rows.map((row) => row.id);
    const { data, error } = await supabase
      .from('assignment_assignees')
      .select('assignment_id, profiles!assignment_assignees_user_id_fkey(full_name)')
      .in('assignment_id', ids);

    if (error || !data) {
      return rows;
    }

    const assigneeMap = new Map<string, string[]>();
    data.forEach((row: any) => {
      const fullName = row.profiles?.full_name as string | undefined;
      if (!fullName) return;
      const list = assigneeMap.get(row.assignment_id) || [];
      list.push(fullName);
      assigneeMap.set(row.assignment_id, list);
    });

    return rows.map((assignment) => {
      const names = assigneeMap.get(assignment.id);
      return {
        ...assignment,
        assignee: names && names.length > 0
          ? Array.from(new Set(names)).join(', ')
          : assignment.assignee || 'Unassigned',
      };
    });
  }

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setAssignments([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role === 'Admin') {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const hydrated = await withAssigneesFromJunction(data || []);
        setAssignments(hydrated);
        return;
      }

      const { data: linkRows, error: linksError } = await supabase
        .from('assignment_assignees')
        .select('assignment_id')
        .eq('user_id', user.id);

      if (linksError) throw linksError;

      const assignmentIds = (linkRows || []).map((row: { assignment_id: string }) => row.assignment_id);

      let linkedAssignments: any[] = [];
      if (assignmentIds.length > 0) {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .in('id', assignmentIds);

        if (error) throw error;
        linkedAssignments = data || [];
      }

      const deduped = new Map<string, any>();
      [...linkedAssignments].forEach((item) => {
        deduped.set(item.id, item);
      });

      const scopedAssignments = Array.from(deduped.values()).sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const hydrated = await withAssigneesFromJunction(scopedAssignments);
      setAssignments(hydrated);
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      const permissionIssue = msg.includes('permission') || msg.includes('row-level security') || msg.includes('assignment_assignees');
      toast.error(permissionIssue ? 'Access policy error: unable to read assignment links. Check Supabase RLS for assignment_assignees.' : 'Failed to load assignments.');
      setAssignments([]);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Real-time synchronization
  useRealtime('assignments', fetchAssignments);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (item.assignee && item.assignee.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assignments, searchTerm, statusFilter]);

  async function handleComplete(id: string) {
    try {
      const assignmentToUpdate = assignments.find(a => a.id === id);
      if (!assignmentToUpdate) return;
      const oldStatus = assignmentToUpdate.status;
      
      // Local optimistic update
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'Completed' } : a));
      
      // Handle mocks like the detail sheet does
      if (id.startsWith('mock-')) {
        toast.success('Assignment marked as complete (Mock)');
        return;
      }
      
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ status: 'Completed' })
        .eq('id', id);
  
      if (updateError) throw updateError;
      
      // Log activity for timeline
      const { error: logError } = await supabase
        .from('assignment_activity_logs')
        .insert({
          assignment_id: id,
          action_type: 'status_change',
          previous_value: oldStatus,
          new_value: 'Completed',
          user_name: 'Artkey System'
        });
      
      if (logError) {
        console.warn('Logging error (ignoring):', logError);
      }

      await supabase.from('notifications').insert({
        title: 'Assignment Completed',
        message: `The assignment "${assignmentToUpdate.title}" has been marked as complete.`,
        is_read: false
      });

      toast.success('Assignment marked as complete.');
      fetchAssignments(); 
    } catch (error: any) {
      toast.error(error.message || 'Failed to update assignment.');
      fetchAssignments(); 
    }
  }

  async function handleDelete(id: string) {
    try {
      const itemToDelete = assignments.find(a => a.id === id);
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      
      await supabase.from('notifications').insert({
        title: 'Assignment Deleted',
        message: `The assignment "${itemToDelete?.title || 'Unknown'}" was removed successfully.`,
        is_read: false
      });

      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Assignment deleted successfully.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete assignment.');
    }
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full md:min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h1>
          <p className="text-sm text-muted-foreground tracking-tight">
            Manage your project tasks and delivery pipelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <Input 
              placeholder="Search assignments..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card/40 border-white/10 rounded-xl focus-visible:ring-primary/50"
            />
          </div>

          <Select 
            value={statusFilter} 
            onValueChange={(val) => setStatusFilter(val || 'all')}
          >
            <SelectTrigger className="w-full md:w-40 bg-card/40 border-white/10 rounded-xl px-4">
              <div className="flex items-center gap-2">
                <Filter size={14} className="opacity-60" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <CreateAssignmentDialog onSuccess={fetchAssignments}>
            <Button className="rounded-xl h-10 px-4 gap-2 font-medium tracking-tight">
              <Plus size={16} /> New Assignment
            </Button>
          </CreateAssignmentDialog>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full"
      >
        <AssignmentTable 
          data={filteredAssignments} 
          loading={loading}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onRefresh={fetchAssignments}
        />
      </motion.div>
    </div>
  );
}
