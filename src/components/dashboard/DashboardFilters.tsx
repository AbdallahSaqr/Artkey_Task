'use client';

import { useState } from 'react';
import { Filter, Calendar as CalendarIcon, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FiltersProps {
  onFiltersChange: (filters: any) => void;
  assignees: string[];
}

export function DashboardFilters({ onFiltersChange, assignees }: FiltersProps) {
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [date, setDate] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  function handleFilterApply(newFilters: any) {
    onFiltersChange({
      status: status || 'all',
      priority: priority || 'all',
      assignee: assignee || 'all',
      dateRange: date,
      ...newFilters,
    });
  }

  function resetFilters() {
    setStatus("");
    setPriority("");
    setAssignee("");
    setDate(undefined);
    onFiltersChange({ status: 'all', priority: 'all', assignee: 'all', dateRange: undefined });
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 w-full bg-card/40 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-xl shadow-black/5 relative z-10">
      <div className="flex items-center gap-2 px-1 text-muted-foreground">
        <Filter size={16} className="opacity-60" />
        <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 flex-1 w-full overflow-visible">
        <Select value={status} onValueChange={(val: any) => { setStatus(val); handleFilterApply({ status: val || 'all' }); }}>
          <SelectTrigger className="bg-background/40 border-white/10 rounded-2xl h-10 ring-offset-background focus:ring-primary/50 text-xs font-medium px-4 min-w-[200px] flex-1 md:flex-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 px-4 z-[100] min-w-[200px]">
            <SelectItem value="all">Every Status</SelectItem>
            <SelectItem value="Pending">Pending Only</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(val: any) => { setPriority(val); handleFilterApply({ priority: val || 'all' }); }}>
          <SelectTrigger className="bg-background/40 border-white/10 rounded-2xl h-10 ring-offset-background focus:ring-primary/50 text-xs font-medium px-4 min-w-[200px] flex-1 md:flex-none">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 px-4 z-[100] min-w-[200px]">
            <SelectItem value="all">Any Priority</SelectItem>
            <SelectItem value="High">High Impact</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low Priority</SelectItem>
          </SelectContent>
        </Select>

        <Select value={assignee} onValueChange={(val: any) => { setAssignee(val); handleFilterApply({ assignee: val || 'all' }); }}>
          <SelectTrigger className="bg-background/40 border-white/10 rounded-2xl h-10 ring-offset-background focus:ring-primary/50 text-xs font-medium px-4 min-w-[200px] flex-1 md:flex-none">
            <SelectValue placeholder="Assignee(s)" />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 px-4 z-[100] min-w-[200px]">
            <SelectItem value="all">All Team members</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={cn(
                "w-full md:w-[260px] justify-start text-left font-normal bg-background/40 border-white/10 rounded-2xl h-10 ring-offset-background focus:ring-primary/50 text-xs",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd")} - {format(date.to, "LLL dd")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl z-[100]" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={(range) => { setDate(range); handleFilterApply({ dateRange: range }); }}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={resetFilters}
        className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all rounded-xl h-10 px-4"
      >
        <X size={14} className="mr-1.5" />
        Reset
      </Button>
    </div>
  );
}
