'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sparkles } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { NAV_ITEMS } from './sidebar';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={
          <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-foreground/[0.04]">
            <Menu size={20} className="text-muted-foreground" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        } />
        <SheetContent side="left" className="w-[80%] max-w-[300px] bg-background/95 backdrop-blur-3xl border-r border-border p-0 flex flex-col h-full">
          <SheetHeader className="p-6 pb-4 border-b border-border flex flex-row items-center justify-between">
            <SheetTitle className="text-xl font-bold tracking-tight text-foreground -mb-1">
               Artkey Navigation
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto w-full px-4 py-8 flex flex-col gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-base transition-all duration-200 active:scale-[0.97]",
                    isActive 
                      ? "bg-primary/10 text-primary font-bold shadow-[0_0_20px_rgba(var(--primary),0.05)] border border-primary/20" 
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      "transition-colors shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="tracking-tight">{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="p-6 mt-auto border-t border-border bg-white/[0.01]">
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex flex-col gap-3">
               <div className="flex items-center gap-2 text-primary">
                 <Sparkles size={16} />
                 <span className="text-xs font-bold uppercase tracking-widest">Premium Plan</span>
               </div>
               <p className="text-[11px] text-muted-foreground leading-relaxed">
                 You are currently using the Professional Creator Tier. Enjoy unlimited schedules.
               </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
