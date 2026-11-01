import Link from 'next/link';
import { Compass, LayoutDashboard } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft ring-1 ring-slate-200">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">This page does not exist</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The route may have moved. PulseWatch uses fixed routes with query parameters for monitor and incident details.
        </p>
        <Link href="/dashboard" className={buttonClasses('primary', 'md', 'mt-6')}>
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
