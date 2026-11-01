'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { normalizePathname } from '@/lib/format';
import { AppShell } from '@/components/app-shell';
import { FullPageLoading } from '@/components/loading';

const PUBLIC_ROUTES = new Set(['/', '/login', '/register']);

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = normalizePathname(usePathname());

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <FullPageLoading label="Checking your session…" />;
  }
  if (!user) {
    return <FullPageLoading label="Redirecting to sign in…" />;
  }
  return <AppShell>{children}</AppShell>;
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = normalizePathname(usePathname());
  if (PUBLIC_ROUTES.has(pathname)) {
    return <>{children}</>;
  }
  return <Protected>{children}</Protected>;
}
