'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Download,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  CheckCheck,
  Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { AssignmentDetailSheet } from '@/components/AssignmentDetailSheet';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { ExportDialog } from '@/components/ExportDialog';
import { AssignmentSkeleton } from './assignment-skeleton';

// ── Types ─────────────────────────────────────────────────────────────────
type Status = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

interface Assignment {
  id: string;
  title: string;
  assignee: string;
  due_date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: Status;
  created_by?: string;
}

// ── Status badge config ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  Status,
  { bg: string; text: string; ring: string; dot: string }
> = {
  Pending: {
    bg: 'bg-amber-500/12',
    text: 'text-amber-400',
    ring: 'ring-amber-500/25',
    dot: 'bg-amber-400',
  },
  'In Progress': {
    bg: 'bg-blue-500/12',
    text: 'text-blue-400',
    ring: 'ring-blue-500/25',
    dot: 'bg-blue-400',
  },
  Completed: {
    bg: 'bg-emerald-500/12',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  Overdue: {
    bg: 'bg-rose-500/12',
    text: 'text-rose-400',
    ring: 'ring-rose-500/25',
    dot: 'bg-rose-400',
  },
};

const PRIORITY_CONFIG: Record<
  Assignment['priority'],
  { text: string; dot: string }
> = {
  High: { text: 'text-rose-400', dot: 'bg-rose-400' },
  Medium: { text: 'text-amber-400', dot: 'bg-amber-400' },
  Low: { text: 'text-emerald-400', dot: 'bg-emerald-400' },
};

// ── Animated Row ──────────────────────────────────────────────────────────
function AnimatedRow({
  row,
  onComplete,
  onDelete,
  onSelect,
  isAdmin,
  currentUserId,
}: {
  row: Assignment;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  isAdmin?: boolean;
  currentUserId?: string;
}) {
  const canDelete = isAdmin || (currentUserId && row.created_by === currentUserId);
  return (
    <motion.tr
      key={row.id}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scaleY: 0.4, originY: 0 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.8 }}
      className="border-b border-white/[0.06] hover:bg-white/[0.025] transition-colors group cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect(row.id);
      }}
    >
      <TableCell className="pl-5 py-3.5">
        <span className="text-sm font-medium tracking-tight text-foreground">{row.title}</span>
      </TableCell>
      <TableCell className="py-3.5">
        {(() => {
          const names = row.assignee ? row.assignee.split(', ').filter(Boolean) : [];
          const first = names[0] || 'Unassigned';
          const extra = names.length > 1 ? names.length - 1 : 0;
          return (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground tracking-tight">
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-1 ring-white/10 shrink-0">
                {first.split(' ').map((n) => n[0]).join('')}
              </span>
              {first}
              {extra > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  +{extra}
                </span>
              )}
            </span>
          );
        })()}
      </TableCell>
      <TableCell className="py-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tracking-tight">
          <Calendar size={11} className="opacity-60" />
          {new Date(row.due_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </TableCell>
      <TableCell className="py-3.5">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium tracking-tight', PRIORITY_CONFIG[row.priority]?.text)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_CONFIG[row.priority]?.dot)} />
          {row.priority}
        </span>
      </TableCell>
      <TableCell className="py-3.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight',
            'ring-1 ring-inset',
            STATUS_CONFIG[row.status]?.bg, STATUS_CONFIG[row.status]?.text, STATUS_CONFIG[row.status]?.ring,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_CONFIG[row.status]?.dot)} />
          {row.status}
        </span>
      </TableCell>
      <TableCell className="py-3.5 pr-5 text-right overflow-visible">
        <DropdownMenu>
          <DropdownMenuTrigger 
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-8 w-8 p-0 transition-opacity hover:bg-white/10 rounded-xl flex items-center justify-center border-0 cursor-pointer"
            )}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal size={16} className="text-muted-foreground transition-colors group-hover/button:text-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] bg-card/95 backdrop-blur-xl border-white/10 z-[100] shadow-2xl rounded-2xl p-1.5 border border-white/5">
            <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    Action Console
                </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-white/10 mx-[-6px] my-1.5" />
            <DropdownMenuItem 
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelect(row.id); }}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer hover:bg-white/10 focus:bg-white/10 outline-none"
            >
              <ExternalLink size={14} className="text-blue-400" />
              View Details
            </DropdownMenuItem>
            
            {row.status !== 'Completed' && (
              <DropdownMenuItem 
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onComplete(row.id); }}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer hover:bg-emerald-500/15 focus:bg-emerald-500/15 text-emerald-400/90 hover:text-emerald-400 focus:text-emerald-400 outline-none"
              >
                <CheckCheck size={14} />
                Mark Completed
              </DropdownMenuItem>
            )}

            {canDelete && (
              <>
                <DropdownMenuSeparator className="bg-white/10 mx-[-6px] my-1.5" />
                <DropdownMenuItem 
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(row.id); }}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer hover:bg-rose-500/15 focus:bg-rose-500/15 text-rose-400/90 hover:text-rose-400 focus:text-rose-400 outline-none"
                >
                  <Trash2 size={14} />
                  Delete Assignment
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </motion.tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
interface AssignmentTableProps {
  data: Assignment[];
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function AssignmentTable({ data, onComplete, onDelete, onRefresh, loading }: AssignmentTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setRole(data.role);
      }
    }
    getRole();
  }, [supabase]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 w-full mb-10">
      <div className="rounded-3xl bg-card/60 backdrop-blur-md border border-border/50 shadow-2xl ring-1 ring-white/5">
        <div className="px-5 py-3 border-b border-border/50 bg-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground/80 uppercase">Assignments List</h3>
            <ExportDialog data={data}>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all">
                    <Download size={12} />
                    Export
                </button>
            </ExportDialog>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <Table className="min-w-[700px] md:min-w-full">
            <TableHeader>
              <TableRow className="border-b border-border/50 hover:bg-transparent">
                <TableHead className="pl-5 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap text-left border-0">Task</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap text-left border-0">Assignee</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap text-left border-0">Due Date</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap text-left border-0">Priority</TableHead>
                <TableHead className="py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap text-left border-0">Status</TableHead>
                <TableHead className="w-[50px] border-0"></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <AnimatePresence initial={false} mode="popLayout">
                {loading ? (
                  <TableRow className="hover:bg-transparent border-0">
                    <TableCell colSpan={6} className="p-0">
                      <AssignmentSkeleton />
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <motion.tr
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="py-16 text-center">
                      <p className="text-sm text-muted-foreground tracking-tight italic">
                        No assignments found matching these criteria
                      </p>
                    </td>
                  </motion.tr>
                ) : (
                  data.map((row: Assignment) => (
                    <AnimatedRow
                      key={row.id}
                      row={row}
                      onComplete={onComplete!}
                      onDelete={onDelete!}
                      onSelect={handleSelect}
                      isAdmin={role === 'Admin'}
                      currentUserId={userId || undefined}
                    />
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>

      <AssignmentDetailSheet 
        assignmentId={selectedId} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
        onStatusChange={onRefresh}
        onDelete={onRefresh}
      />
    </div>
  );
}
