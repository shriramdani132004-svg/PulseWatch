import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonitorForm } from '@/components/monitor-form';
import { ToastProvider } from '@/components/toast';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('MonitorForm', () => {
  it('rejects a non-HTTP target before making a request', async () => {
    render(
      <ToastProvider>
        <MonitorForm />
      </ToastProvider>,
    );

    fireEvent.change(screen.getByLabelText(/monitor name/i), {
      target: { value: 'Example endpoint' },
    });
    fireEvent.change(screen.getByLabelText(/target url/i), {
      target: { value: 'ftp://example.com/file' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create monitor/i }));

    expect(await screen.findByText('Only HTTP and HTTPS URLs are supported.')).toBeInTheDocument();
    expect(screen.getByText('Review the highlighted fields before saving.')).toBeInTheDocument();
  });

  it('shows stored header names without exposing their values when editing', () => {
    render(
      <ToastProvider>
        <MonitorForm
          monitor={{
            id: '9f4c7f80-5aa6-4e6f-9c83-8c9f7d7a9f31',
            name: 'Existing monitor',
            description: null,
            targetUrl: 'https://example.com/health',
            method: 'GET',
            intervalSeconds: 300,
            timeoutMs: 10000,
            expectedStatusMin: 200,
            expectedStatusMax: 299,
            failureThreshold: 3,
            recoveryThreshold: 1,
            degradedResponseTimeMs: 2000,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            currentStatus: 'OPERATIONAL',
            lastCheckedAt: null,
            nextCheckAt: null,
            pausedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hasCustomHeaders: true,
            headerNames: ['Authorization'],
            isStale: false,
            latestCheck: null,
          }}
        />
      </ToastProvider>,
    );

    expect(screen.getByText(/Names: Authorization/)).toBeInTheDocument();
    expect(screen.getByText(/Values are encrypted and cannot be displayed/)).toBeInTheDocument();
  });
});
