'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/format';
import { FullPageLoading } from '@/components/loading';

function passwordChecks(password: string) {
  return [
    { label: 'At least 10 characters', met: password.length >= 10 },
    { label: 'Contains a letter', met: /[A-Za-z]/.test(password) },
    { label: 'Contains a number', met: /\d/.test(password) },
  ];
}

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checks = useMemo(() => passwordChecks(password), [password]);
  const strongEnough = checks.every((check) => check.met);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  if (loading) return <FullPageLoading label="Preparing registration…" />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Enter your name (at least 2 characters).');
      return;
    }
    if (!email.trim()) {
      setError('Enter a valid email address.');
      return;
    }
    if (!strongEnough) {
      setError('Choose a stronger password that meets all requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your workspace"
      description="Register an account and start with a real endpoint observation."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        ) : null}
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            hint="Use at least 10 characters with a letter and a number."
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-[34px] rounded-lg p-1 text-slate-400 transition hover:text-slate-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-3">
          {checks.map((check) => (
            <span
              key={check.label}
              className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', check.met ? 'text-emerald-700' : 'text-slate-500')}
            >
              <span className={cn('grid h-4 w-4 place-items-center rounded-full', check.met ? 'bg-emerald-100' : 'bg-slate-200')}>
                <Check className="h-2.5 w-2.5" aria-hidden />
              </span>
              {check.label}
            </span>
          ))}
        </div>
        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Create account
        </Button>
        <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
          Sessions use HttpOnly cookies. Passwords are hashed with bcrypt and never returned by the API.
        </p>
      </form>
    </AuthShell>
  );
}
