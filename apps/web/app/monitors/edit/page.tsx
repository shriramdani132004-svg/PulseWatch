'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import type { Monitor } from '@pulsewatch/shared';
import { useApiQuery } from '@/lib/hooks';
import { PageHeader, MonitoringNotice } from '@/components/ui/page';
import { MonitorForm } from '@/components/monitor-form';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PageSkeleton } from '@/components/loading';

function EditMonitorContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { data, error, loading, refetch } = useApiQuery<Monitor>(id ? `/monitors/${id}` : null);

  if (!id) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="No monitor selected"
          description="Open a monitor from the list and choose Edit, or use the link below."
          action={
            <Link href="/monitors" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Back to monitors
            </Link>
          }
        />
      </Card>
    );
  }

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={refetch} />
      </Card>
    );
  }
  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Link href={`/monitor?id=${data.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to {data.name}
      </Link>
      <PageHeader
        eyebrow="Edit endpoint"
        title={`Edit ${data.name}`}
        description="Changes apply to future checks. Existing observations and incident history remain unchanged."
      />
      <MonitoringNotice text="If you replace custom headers, every stored header is replaced. Existing header values cannot be read back; enter complete replacement values." />
      <MonitorForm monitor={data} />
    </div>
  );
}

export default function EditMonitorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditMonitorContent />
    </Suspense>
  );
}
