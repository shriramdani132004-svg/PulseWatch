import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />;
}

export function FullPageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f7fb]">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-soft ring-1 ring-slate-200">
          <Spinner className="h-5 w-5 text-brand-600" />
        </span>
        <p className="text-sm font-medium">{label}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading content" role="status">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
