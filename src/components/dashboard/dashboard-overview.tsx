'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, isWithinInterval, format, subMonths, isSameMonth, isPast, parseISO } from 'date-fns';

import { AssignmentTable } from '@/components/assignments/assignment-table';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { createClient } from '@/lib/supabase/client';
import { useRealtime } from '@/hooks/use-realtime';

// ── Types ─────────────────────────────────────────────────────────────────
interface Metric {
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  glowColor: string;
}

interface TrendPoint {
  month: string;
  completed: number;
}

interface Assignment {
  id: string;
  title: string;
  assignee: string;
  due_date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
  created_at: string;
}

// ── Animation variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 340, damping: 26, mass: 0.9 },
  },
};

const chartVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 28, delay: 0.45 },
  },
};

// ── Custom Tooltip ────────────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/90 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-muted-foreground tracking-tight mb-0.5">{label}</p>
      <p className="text-base font-bold tracking-tight text-foreground">
        {payload[0].value}
        <span className="text-xs font-normal text-muted-foreground ml-1">completed</span>
      </p>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
      className={`
        relative flex flex-col gap-4 p-5
        rounded-2xl bg-card/60 backdrop-blur-md
        border border-border/50
        shadow-[0_2px_12px_0_rgba(0,0,0,0.22)]
        ring-1 ring-inset ring-foreground/[0.04]
        cursor-default
        transition-all duration-200
        ${metric.glowColor}
      `}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${metric.iconBg}`}>
        <Icon size={18} strokeWidth={2} className={metric.iconColor} />
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-foreground leading-none mb-1">
          {metric.value}
        </p>
        <p className="text-xs text-muted-foreground tracking-tight">{metric.label}</p>
      </div>
      <p
        className={`text-[11px] font-medium tracking-tight ${
          metric.positive ? 'text-emerald-400' : 'text-rose-400'
        }`}
      >
        {metric.change}
      </p>
      <span
        className="pointer-events-none absolute top-0 left-0 w-24 h-24 rounded-tl-2xl opacity-10 metric-card-glow"
      />
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export function DashboardOverview() {
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>({
    status: 'all',
    priority: 'all',
    assignee: 'all',
    dateRange: undefined
  });

  const supabase = createClient();

  async function withAssigneesFromJunction(rows: Assignment[]) {
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
      } as Assignment;
    });
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
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
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const hydrated = await withAssigneesFromJunction((data || []) as Assignment[]);
        setAllAssignments(hydrated);
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
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const hydrated = await withAssigneesFromJunction(scopedAssignments as Assignment[]);
      setAllAssignments(hydrated);
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      const permissionIssue = msg.includes('permission') || msg.includes('row-level security') || msg.includes('assignment_assignees');
      toast.error(permissionIssue ? 'Access policy error: unable to read assignment links. Check Supabase RLS for assignment_assignees.' : 'Real-time synchronization failure.');
      setAllAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener
  useRealtime('assignments', fetchData);
  useRealtime('schedules', fetchData);

  // Filter logic
  const filteredData = useMemo(() => {
    return allAssignments.filter((item) => {
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesPriority = filters.priority === 'all' || item.priority === filters.priority;
      const matchesAssignee = filters.assignee === 'all' || item.assignee === filters.assignee;
      
      let matchesDate = true;
      if (filters.dateRange?.from) {
        const itemDate = new Date(item.due_date);
        if (filters.dateRange.to) {
          matchesDate = isWithinInterval(itemDate, {
            start: filters.dateRange.from,
            end: filters.dateRange.to,
          });
        } else {
          matchesDate = itemDate.toDateString() === filters.dateRange.from.toDateString();
        }
      }
      
      return matchesStatus && matchesPriority && matchesAssignee && matchesDate;
    });
  }, [allAssignments, filters]);

  // Metric computations
  const metricsData: Metric[] = useMemo(() => {
    const total = filteredData.length;
    const completed = filteredData.filter(a => a.status === 'Completed').length;
    const overdue = filteredData.filter(a => (a.status as string) !== 'Completed' && isPast(parseISO(a.due_date))).length;
    const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

    return [
      {
        label: 'Global Pipeline',
        value: total.toLocaleString(),
        change: `${total} tasks active`,
        positive: true,
        icon: TrendingUp,
        iconBg: 'bg-blue-500/15',
        iconColor: 'text-blue-400',
        glowColor: 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.35)]',
      },
      {
        label: 'Success Rate',
        value: `${rate}%`,
        change: 'Based on filters',
        positive: true,
        icon: Clock,
        iconBg: 'bg-violet-500/15',
        iconColor: 'text-violet-400',
        glowColor: 'hover:shadow-[0_0_0_1px_rgba(167,139,250,0.35)]',
      },
      {
        label: 'Completed',
        value: completed.toLocaleString(),
        change: 'Records Resolved',
        positive: true,
        icon: CheckCircle2,
        iconBg: 'bg-emerald-500/15',
        iconColor: 'text-emerald-400',
        glowColor: 'hover:shadow-[0_0_0_1px_rgba(52,211,153,0.35)]',
      },
      {
        label: 'Delinquent Tasks',
        value: overdue.toLocaleString(),
        change: 'Time-sensitive Action',
        positive: false,
        icon: AlertCircle,
        iconBg: 'bg-rose-500/15',
        iconColor: 'text-rose-400',
        glowColor: 'hover:shadow-[0_0_0_1px_rgba(251,113,133,0.35)]',
      },
    ];
  }, [filteredData]);

  // Trend computation (Last 9 months based on creation and completion)
  const trendData: TrendPoint[] = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const targetDate = subMonths(new Date(), 8 - i);
      const monthLabel = format(targetDate, 'MMM');
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);

      const count = filteredData.filter(a => 
        a.status === 'Completed' && 
        isWithinInterval(parseISO(a.created_at), { start, end })
      ).length;

      return {
        month: monthLabel,
        completed: count
      };
    });
  }, [filteredData]);

  const uniqueAssignees = useMemo(() => {
    return Array.from(new Set(allAssignments.map(a => a.assignee).filter(Boolean)));
  }, [allAssignments]);

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto w-full min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground tracking-tight">
          Real-time analytics and project delivery tracking.
        </p>
      </div>

      <DashboardFilters 
        assignees={uniqueAssignees} 
        onFiltersChange={setFilters} 
      />

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {metricsData.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </motion.div>

      <motion.div
        variants={chartVariants}
        initial="hidden"
        animate="visible"
        className="
          flex flex-col gap-5 p-6
          rounded-3xl bg-card/60 backdrop-blur-md
          border border-white/[0.08]
          shadow-2xl shadow-black/20
          ring-1 ring-inset ring-white/[0.04]
        "
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Completion Pipeline
            </h2>
            <p className="text-xs text-muted-foreground tracking-tight mt-0.5">
              Historical delivery trend based on filtered criteria
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.556 0 0)', fontSize: 11, fontWeight: 500 }}
                dy={12}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.556 0 0)', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="oklch(0.627 0.265 273.15)"
                strokeWidth={3}
                fill="url(#completedGradient)"
                dot={{ r: 4, fill: 'oklch(0.627 0.265 273.15)', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'oklch(0.627 0.265 273.15)', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Activity</h2>
        </div>
        <AssignmentTable 
          data={filteredData.slice(0, 10)} 
          loading={loading}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
