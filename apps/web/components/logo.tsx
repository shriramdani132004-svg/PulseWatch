import { Activity } from 'lucide-react';
import { cn } from '@/lib/format';

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-sm">
        <Activity className="h-5 w-5 text-white" aria-hidden />
      </span>
      {!compact ? (
        <span className={cn('text-[17px] font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
          Pulse<span className={light ? 'text-accent-400' : 'text-brand-600'}>Watch</span>
        </span>
      ) : null}
    </span>
  );
}
