import { PageTransition } from '@/components/layout/page-transition';
import { TopHeader } from '@/components/layout/top-header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopHeader />
      {/* ── Main responsive frame beneath the fixed header ─────────────────── */}
      <div className="flex flex-1 pt-14 md:h-screen md:overflow-hidden">
        
        {/* ── Desktop Sidebar (Hidden on md and below) ──────────────────── */}
        <Sidebar />

        {/* ── Scrollable core content area ────────────────────────────── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0 md:h-full relative no-scrollbar">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </>
  );
}
