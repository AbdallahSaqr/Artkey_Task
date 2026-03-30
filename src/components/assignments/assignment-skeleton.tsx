'use client';

import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function AssignmentSkeleton() {
  return (
    <div className="rounded-3xl bg-card/60 backdrop-blur-md border border-border/50 shadow-2xl overflow-hidden ring-1 ring-white/5 animate-pulse">
      <div className="px-5 py-3 border-b border-border/50 bg-white/5 flex items-center justify-between h-12">
        <div className="w-32 h-3 bg-white/10 rounded" />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <TableHead key={i} className="py-3">
                <div className="w-16 h-2 bg-white/5 rounded" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="border-b border-white/[0.06]">
              <TableCell className="py-4 pl-5">
                <div className="w-40 h-3 bg-white/10 rounded" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
                  <div className="w-24 h-2.5 bg-white/5 rounded" />
                </div>
              </TableCell>
              <TableCell>
                <div className="w-20 h-2 bg-white/5 rounded" />
              </TableCell>
              <TableCell>
                <div className="w-16 h-2.5 bg-white/10 rounded" />
              </TableCell>
              <TableCell>
                <div className="w-16 h-4 bg-white/5 rounded-full" />
              </TableCell>
              <TableCell className="pr-5 text-right">
                <div className="w-8 h-8 bg-white/10 rounded-lg ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
