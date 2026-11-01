'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@pulsewatch/shared';
import { CheckCircle2, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { PageHeader, MonitoringNotice } from '@/components/ui/page';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { cn } from '@/lib/format';

function passwordChecks(password: string) {
  return [
    { label: 'At least 10 characters', met: password.length >= 10 },
    { label: 'Contains a letter', met: /[A-Za-z]/.test(password) },
    { label: 'Contains a number', met: /\d/.test(password) },
  ];
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const checks = passwordChecks(newPassword);
  const strongEnough = checks.every((check) => check.met);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    if (name.trim().length < 2) {
      setProfileError('Enter your name (at least 2 characters).');
      return;
    }
    setProfileSaving(true);
    try {
      const data = await api.patch<{ user: AuthUser }>('/users/me', { name: name.trim() });
      setUser(data.user);
      toast.success('Profile updated');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'The profile could not be updated.';
      setProfileError(message);
      toast.error('Profile update failed', message);
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (!strongEnough) {
      setPasswordError('Choose a stronger password that meets all requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('The new password must be different from the current password.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      toast.success('Password changed', 'All sessions were signed out. Please sign in again.');
      setUser(null);
      router.replace('/login');
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'The password could not be changed.';
      setPasswordError(message);
      toast.error('Password change failed', message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const revokeAll = async () => {
    setRevoking(true);
    try {
      await api.post('/users/me/sessions/revoke-all', undefined, { skipRefresh: true });
      toast.success('All sessions revoked');
      setUser(null);
      router.replace('/login');
    } catch (caught) {
      toast.error('Could not revoke sessions', caught instanceof ApiError ? caught.message : 'Please try again.');
      setRevoking(false);
      setRevokeOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, password, and active sessions. Authentication is cookie-based and every session can be revoked."
      />

      <MonitoringNotice text="Passwords are hashed with bcrypt. Access tokens are short-lived; refresh sessions rotate on every use and are stored as hashes in PostgreSQL." />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Profile" description="The name shown in your workspace" />
          <CardBody>
            <form className="space-y-5" onSubmit={saveProfile} noValidate>
              {profileError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                  {profileError}
                </div>
              ) : null}
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white">
                  {user?.name
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'PW'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Account'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email ?? ''}</p>
                </div>
              </div>
              <Input
                label="Full name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
              <div>
                <Input
                  label="Email address"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  hint="Email changes are not supported in this release."
                />
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Mail className="h-3 w-3" aria-hidden />
                  Your email is used only for sign-in.
                </p>
              </div>
              <Button type="submit" loading={profileSaving} leftIcon={<UserRound className="h-4 w-4" />}>
                Save profile
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Password" description="Changing it signs out every active session" />
          <CardBody>
            <form className="space-y-5" onSubmit={changePassword} noValidate>
              {passwordError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                  {passwordError}
                </div>
              ) : null}
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                hint="Use at least 10 characters with a letter and a number."
                required
              />
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-3">
                {checks.map((check) => (
                  <span
                    key={check.label}
                    className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', check.met ? 'text-emerald-700' : 'text-slate-500')}
                  >
                    {check.met ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
                    {check.label}
                  </span>
                ))}
              </div>
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <Button
                type="submit"
                loading={passwordSaving}
                leftIcon={<KeyRound className="h-4 w-4" />}
                disabled={!strongEnough}
              >
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Session security" description="How this workspace protects your account" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: LockKeyhole, title: 'HttpOnly cookies', text: 'Tokens are never readable by client-side JavaScript.' },
              { icon: ShieldCheck, title: 'Rotating refresh tokens', text: 'Each refresh invalidates the previous refresh token.' },
              { icon: KeyRound, title: 'Hashed sessions', text: 'Only a keyed hash of each refresh token is stored.' },
              { icon: LogOut, title: 'Global revocation', text: 'Signing out everywhere immediately invalidates every session.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200">
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

        <Card>
          <CardHeader title="Active sessions" description="Revoke access from every device" />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Revoking all sessions signs you out immediately and invalidates every refresh token issued for this account.
            </p>
            <Button variant="danger" onClick={() => setRevokeOpen(true)} leftIcon={<LogOut className="h-4 w-4" />}>
              Revoke all sessions
            </Button>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={() => void revokeAll()}
        title="Revoke every session?"
        description="You will be signed out on every device, including this one. You can sign back in with your password."
        confirmLabel="Revoke all sessions"
        loading={revoking}
        destructive
      />
    </div>
  );
}
