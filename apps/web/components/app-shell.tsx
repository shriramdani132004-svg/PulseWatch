'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Siren,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn, normalizePathname } from '@/lib/format';
import { Logo } from '@/components/logo';
import { API_DOCS_URL } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/monitors', label: 'Monitors', icon: Activity },
  { href: '/incidents', label: 'Incidents', icon: Siren },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/monitors': 'Monitors',
  '/monitors/new': 'Create monitor',
  '/monitors/edit': 'Edit monitor',
  '/monitor': 'Monitor details',
  '/incidents': 'Incidents',
  '/incidents/detail': 'Incident details',
  '/reports': 'Reports',
  '/settings': 'Account settings',
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/monitors') return pathname === '/monitors' || pathname === '/monitor' || pathname === '/monitors/new' || pathname === '/monitors/edit';
  if (href === '/incidents') return pathname.startsWith('/incidents');
  return pathname === href;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = normalizePathname(usePathname());
  return (
    <nav className="space-y-1" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                : 'text-slate-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon className={cn('h-[18px] w-[18px]', active ? 'text-accent-400' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden />
            <span className="flex-1">{item.label}</span>
            {active ? <ChevronRight className="h-4 w-4 text-white/50" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link href="/dashboard" onClick={onNavigate} aria-label="PulseWatch dashboard">
          <Logo light />
        </Link>
        <p className="mt-2 pl-[46px] text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          API observability
        </p>
      </div>
      <div className="px-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="mt-auto space-y-3 p-4">
        <Link
          href="/monitors/new"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Activity className="h-4 w-4" aria-hidden />
          Add monitor
        </Link>
        {API_DOCS_URL ? (
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            API documentation
          </a>
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-xs font-bold text-white">
              {initials || 'PW'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Account'}</p>
              <p className="truncate text-xs text-slate-400">{user?.email ?? ''}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = normalizePathname(usePathname());
  const [open, setOpen] = useState(false);
  const title = TITLES[pathname] ?? 'PulseWatch';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[110] -translate-y-20 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-lift transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink-900 lg:block">
        <SidebarContent />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f6f7fb]/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:text-slate-900 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
              <p className="hidden text-xs text-slate-500 sm:block">Observation-based API monitoring</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Dashboard live
            </span>
            <Link
              href="/monitors/new"
              className="hidden rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:inline-flex"
            >
              New monitor
            </Link>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
