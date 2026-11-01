'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, MonitoringNotice } from '@/components/ui/page';
import { MonitorForm } from '@/components/monitor-form';

export default function NewMonitorPage() {
  return (
    <div className="space-y-6">
      <Link href="/monitors" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to monitors
      </Link>
      <PageHeader
        eyebrow="New endpoint"
        title="Create a monitor"
        description="Define what to check and how failures should become incidents. The first real check is queued immediately."
      />
      <MonitoringNotice text="The target must resolve only to public addresses. PulseWatch validates DNS, pins a validated IP, verifies TLS, and re-validates every redirect." />
      <MonitorForm />
    </div>
  );
}
