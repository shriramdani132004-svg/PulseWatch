'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { Monitor, MonitorMethod } from '@pulsewatch/shared';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/toast';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/format';

interface HeaderRow {
  id: string;
  name: string;
  value: string;
}

interface MonitorPayload {
  name: string;
  description?: string;
  targetUrl: string;
  method: MonitorMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  failureThreshold: number;
  recoveryThreshold: number;
  degradedResponseTimeMs: number;
  customHeaders?: Array<{ name: string; value: string }>;
  clearCustomHeaders?: boolean;
}

const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'POST', label: 'POST' },
];

const INTERVAL_OPTIONS = [
  { value: '60', label: 'Every 1 minute' },
  { value: '120', label: 'Every 2 minutes' },
  { value: '300', label: 'Every 5 minutes' },
  { value: '600', label: 'Every 10 minutes' },
  { value: '900', label: 'Every 15 minutes' },
  { value: '1800', label: 'Every 30 minutes' },
  { value: '3600', label: 'Every hour' },
];

const TIMEOUT_OPTIONS = [
  { value: '3000', label: '3 seconds' },
  { value: '5000', label: '5 seconds' },
  { value: '10000', label: '10 seconds' },
  { value: '15000', label: '15 seconds' },
  { value: '30000', label: '30 seconds' },
];

function rowId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function MonitorForm({ monitor }: { monitor?: Monitor }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(monitor);

  const [name, setName] = useState(monitor?.name ?? '');
  const [description, setDescription] = useState(monitor?.description ?? '');
  const [targetUrl, setTargetUrl] = useState(monitor?.targetUrl ?? '');
  const [method, setMethod] = useState<MonitorMethod>(monitor?.method ?? 'GET');
  const [intervalSeconds, setIntervalSeconds] = useState(String(monitor?.intervalSeconds ?? 300));
  const [timeoutMs, setTimeoutMs] = useState(String(monitor?.timeoutMs ?? 10000));
  const [expectedStatusMin, setExpectedStatusMin] = useState(String(monitor?.expectedStatusMin ?? 200));
  const [expectedStatusMax, setExpectedStatusMax] = useState(String(monitor?.expectedStatusMax ?? 299));
  const [failureThreshold, setFailureThreshold] = useState(String(monitor?.failureThreshold ?? 3));
  const [recoveryThreshold, setRecoveryThreshold] = useState(String(monitor?.recoveryThreshold ?? 1));
  const [degradedResponseTimeMs, setDegradedResponseTimeMs] = useState(
    String(monitor?.degradedResponseTimeMs ?? 2000),
  );
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [replaceHeaders, setReplaceHeaders] = useState(!editing);
  const [clearCustomHeaders, setClearCustomHeaders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const storedHeaderNames = monitor?.headerNames ?? [];
  const hasStoredHeaders = Boolean(monitor?.hasCustomHeaders && storedHeaderNames.length > 0);

  const headerPayload = useMemo(() => {
    const cleaned = headers
      .map((row) => ({ name: row.name.trim(), value: row.value }))
      .filter((row) => row.name.length > 0 || row.value.length > 0);
    return cleaned;
  }, [headers]);

  const addHeader = () => {
    if (headers.length >= 20) return;
    setHeaders((current) => [...current, { id: rowId(), name: '', value: '' }]);
  };

  const updateHeader = (id: string, field: 'name' | 'value', value: string) => {
    setHeaders((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const removeHeader = (id: string) => {
    setHeaders((current) => current.filter((row) => row.id !== id));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 1) errors.name = 'Give this monitor a name.';
    if (name.trim().length > 100) errors.name = 'Use 100 characters or fewer.';
    if (!targetUrl.trim()) {
      errors.targetUrl = 'Enter the URL to monitor.';
    } else {
      try {
        const parsed = new URL(targetUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.targetUrl = 'Only HTTP and HTTPS URLs are supported.';
        }
        if (parsed.username || parsed.password) {
          errors.targetUrl = 'Remove embedded credentials from the URL.';
        }
      } catch {
        errors.targetUrl = 'Enter a complete URL including https:// or http://.';
      }
    }
    if (toNumber(expectedStatusMin, 0) < 100 || toNumber(expectedStatusMin, 0) > 599) {
      errors.expectedStatusMin = 'Use an HTTP status between 100 and 599.';
    }
    if (toNumber(expectedStatusMax, 0) < 100 || toNumber(expectedStatusMax, 0) > 599) {
      errors.expectedStatusMax = 'Use an HTTP status between 100 and 599.';
    }
    if (toNumber(expectedStatusMax, 0) < toNumber(expectedStatusMin, 0)) {
      errors.expectedStatusMax = 'The maximum must be greater than or equal to the minimum.';
    }
    if (toNumber(failureThreshold, 0) < 1 || toNumber(failureThreshold, 0) > 10) {
      errors.failureThreshold = 'Use a failure threshold between 1 and 10.';
    }
    if (toNumber(recoveryThreshold, 0) < 1 || toNumber(recoveryThreshold, 0) > 10) {
      errors.recoveryThreshold = 'Use a recovery threshold between 1 and 10.';
    }
    if (replaceHeaders && !clearCustomHeaders) {
      const names = new Set<string>();
      for (const row of headerPayload) {
        const normalized = row.name.toLowerCase();
        if (!row.name || !row.value) {
          errors.headers = 'Every custom header needs both a name and a value.';
          break;
        }
        if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(row.name)) {
          errors.headers = `"${row.name}" is not a valid HTTP header name.`;
          break;
        }
        if (names.has(normalized)) {
          errors.headers = `Header "${row.name}" appears more than once.`;
          break;
        }
        names.add(normalized);
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Review the highlighted fields before saving.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: MonitorPayload = {
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      method,
      intervalSeconds: toNumber(intervalSeconds, 300),
      timeoutMs: toNumber(timeoutMs, 10000),
      expectedStatusMin: toNumber(expectedStatusMin, 200),
      expectedStatusMax: toNumber(expectedStatusMax, 299),
      failureThreshold: toNumber(failureThreshold, 3),
      recoveryThreshold: toNumber(recoveryThreshold, 1),
      degradedResponseTimeMs: toNumber(degradedResponseTimeMs, 2000),
    };
    if (description.trim()) payload.description = description.trim();

    if (editing) {
      if (clearCustomHeaders) {
        payload.clearCustomHeaders = true;
      } else if (replaceHeaders) {
        payload.customHeaders = headerPayload;
      }
    } else {
      payload.customHeaders = headerPayload;
    }

    setSaving(true);
    try {
      const saved = editing && monitor
        ? await api.patch<Monitor>(`/monitors/${monitor.id}`, payload)
        : await api.post<Monitor>('/monitors', payload);
      toast.success(editing ? 'Monitor updated' : 'Monitor created', `${saved.name} is ready for monitoring.`);
      router.push(`/monitor?id=${saved.id}`);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'The monitor could not be saved.';
      setError(message);
      toast.error('Could not save monitor', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Endpoint"
              description="The URL PulseWatch will request. Private and reserved addresses are rejected."
            />
            <CardBody className="space-y-5">
              <Input
                label="Monitor name"
                placeholder="Production API"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={fieldErrors.name}
                maxLength={100}
                required
              />
              <Textarea
                label="Description"
                placeholder="What this endpoint powers and who should respond."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                hint="Optional. Visible only in your workspace."
              />
              <Input
                label="Target URL"
                type="url"
                inputMode="url"
                placeholder="https://api.example.com/health"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                error={fieldErrors.targetUrl}
                hint="HTTP or HTTPS. DNS is validated and the public IP is pinned before every request."
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as MonitorMethod)}
                  options={METHOD_OPTIONS}
                  hint="POST requests are sent with an empty body."
                />
                <Select
                  label="Check interval"
                  value={intervalSeconds}
                  onChange={(event) => setIntervalSeconds(event.target.value)}
                  options={INTERVAL_OPTIONS}
                />
                <Select
                  label="Request timeout"
                  value={timeoutMs}
                  onChange={(event) => setTimeoutMs(event.target.value)}
                  options={TIMEOUT_OPTIONS}
                />
                <Input
                  label="Slow-response threshold (ms)"
                  type="number"
                  min={100}
                  max={30000}
                  value={degradedResponseTimeMs}
                  onChange={(event) => setDegradedResponseTimeMs(event.target.value)}
                  hint="Successful checks slower than this are marked degraded."
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Success criteria"
              description="A check succeeds only when the response status is inside this range."
            />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Minimum expected status"
                  type="number"
                  min={100}
                  max={599}
                  value={expectedStatusMin}
                  onChange={(event) => setExpectedStatusMin(event.target.value)}
                  error={fieldErrors.expectedStatusMin}
                />
                <Input
                  label="Maximum expected status"
                  type="number"
                  min={100}
                  max={599}
                  value={expectedStatusMax}
                  onChange={(event) => setExpectedStatusMax(event.target.value)}
                  error={fieldErrors.expectedStatusMax}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Failures before incident"
                  type="number"
                  min={1}
                  max={10}
                  value={failureThreshold}
                  onChange={(event) => setFailureThreshold(event.target.value)}
                  error={fieldErrors.failureThreshold}
                  hint="Consecutive failed checks required to open an incident."
                />
                <Input
                  label="Successes before recovery"
                  type="number"
                  min={1}
                  max={10}
                  value={recoveryThreshold}
                  onChange={(event) => setRecoveryThreshold(event.target.value)}
                  error={fieldErrors.recoveryThreshold}
                  hint="Consecutive successful checks required to resolve an incident."
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Custom request headers"
              description="Optional headers are encrypted at rest with AES-256-GCM and never returned by the API."
              actions={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Encrypted
                </span>
              }
            />
            <CardBody className="space-y-4">
              {hasStoredHeaders ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {storedHeaderNames.length} stored header{storedHeaderNames.length === 1 ? '' : 's'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Names: {storedHeaderNames.join(', ')}. Values are encrypted and cannot be displayed.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={replaceHeaders}
                        disabled={clearCustomHeaders}
                        onChange={(event) => setReplaceHeaders(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      Replace all stored headers
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={clearCustomHeaders}
                        onChange={(event) => {
                          setClearCustomHeaders(event.target.checked);
                          if (event.target.checked) setReplaceHeaders(false);
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      Clear stored headers
                    </label>
                  </div>
                </div>
              ) : null}

              {replaceHeaders && !clearCustomHeaders ? (
                <div className="space-y-3">
                  {headers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
                      No headers added. Add one only if the endpoint requires authentication or a custom user agent.
                    </p>
                  ) : null}
                  {headers.map((header) => (
                    <div key={header.id} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                      <Input
                        label="Header name"
                        value={header.name}
                        onChange={(event) => updateHeader(header.id, 'name', event.target.value)}
                        placeholder="Authorization"
                        containerClassName="space-y-1"
                      />
                      <Input
                        label="Header value"
                        type="password"
                        value={header.value}
                        onChange={(event) => updateHeader(header.id, 'value', event.target.value)}
                        placeholder="Bearer …"
                        autoComplete="off"
                        containerClassName="space-y-1"
                      />
                      <div className="flex items-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHeader(header.id)}
                          aria-label="Remove header"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {fieldErrors.headers ? <p className="text-xs font-medium text-rose-600">{fieldErrors.headers}</p> : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHeader}
                    disabled={headers.length >= 20}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add header
                  </Button>
                </div>
              ) : null}

              {clearCustomHeaders ? (
                <p className="text-xs font-medium text-rose-600">
                  All stored custom headers will be removed when you save.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Before you save" description="What happens next" />
            <CardBody className="space-y-4">
              {[
                { icon: ShieldCheck, title: 'Destination validated', text: 'DNS answers are checked and a public address is pinned for the request.' },
                { icon: Server, title: 'First observation queued', text: 'A newly created monitor is due immediately and checked by the worker.' },
                { icon: CheckCircle2, title: 'No invented history', text: 'Reports begin with the first real check. Empty periods remain gaps.' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
            <Button type="submit" size="lg" loading={saving} className="flex-1">
              {editing ? 'Save changes' : 'Create monitor'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.push(editing && monitor ? `/monitor?id=${monitor.id}` : '/monitors')}
              className="flex-1"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Cancel
            </Button>
            {!editing ? (
              <a href="/monitors" className={cn(buttonClasses('ghost', 'sm'), 'xl:mt-1')}>
                Back to monitors
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
