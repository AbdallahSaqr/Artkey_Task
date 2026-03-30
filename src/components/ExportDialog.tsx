'use client';

import { useState } from 'react';
import { Download, FileText, FileCode, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';

interface ExportDialogProps {
  data: any[];
  children: React.ReactNode;
}

export function ExportDialog({ data, children }: ExportDialogProps) {
  const [format, setFormat] = useState<'CSV' | 'PDF' | ''>('');
  const [open, setOpen] = useState(false);

  const handleDownload = () => {
    if (!data.length) {
       toast.error('No project data available for distillation.');
       return;
    }

    if (!format) {
       toast.error('Please select a target format for distillation.');
       return;
    }

    if (format === 'CSV') {
        exportToCSV(data, `project_export_${Date.now()}`);
    } else {
        exportToPDF(data, `project_export_${Date.now()}`);
    }

    toast.success(`${format} export initialized successfully.`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md bg-card/60 backdrop-blur-2xl border-white/10 shadow-2xl p-0 ring-1 ring-white/5">
        <DialogHeader className="px-6 py-5 border-b border-white/5 bg-white/5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Download className="text-primary" size={20} /> Data Export Console
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Reconcile your project data into a world-class portable document format for analytical distillation.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
           <div className="space-y-3">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                Target Format
              </label>
              <Select value={format} onValueChange={(val: any) => val && setFormat(val)}>
                 <SelectTrigger className="bg-background/40 border-white/10 rounded-2xl h-12 px-5 text-sm font-semibold transition-all hover:bg-background/60 min-w-[240px] w-full">
                    <SelectValue placeholder="Select Format" />
                 </SelectTrigger>
                 <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10 z-[100] min-w-[240px] w-(--anchor-width)">
                    <SelectItem value="CSV" className="py-2.5">
                       <div className="flex items-center gap-3">
                          <FileCode size={16} className="text-blue-400" />
                          <div className="flex flex-col">
                             <span className="text-sm font-bold">CSV Report</span>
                             <span className="text-[10px] text-muted-foreground">Universal delimited data format</span>
                          </div>
                       </div>
                    </SelectItem>
                    <SelectItem value="PDF" className="py-2.5">
                       <div className="flex items-center gap-3">
                          <FileText size={16} className="text-rose-400" />
                          <div className="flex flex-col">
                             <span className="text-sm font-bold">PDF Document</span>
                             <span className="text-[10px] text-muted-foreground">Designer-grade grid-formatted report</span>
                          </div>
                       </div>
                    </SelectItem>
                 </SelectContent>
              </Select>
           </div>

           <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5" />
              <div className="space-y-1">
                 <p className="text-[11px] font-bold text-foreground">Cloud-ready Synchronization</p>
                 <p className="text-[10px] text-muted-foreground leading-relaxed">The distilled report will include all active records from the current filtered dashboard view.</p>
              </div>
           </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/5 shrink-0">
           <Button onClick={handleDownload} className="w-full h-12 rounded-2xl shadow-xl shadow-primary/20 font-bold tracking-tight">
             Export & Download
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
