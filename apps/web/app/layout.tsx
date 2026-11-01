import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/toast';
import { AppFrame } from '@/components/app-frame';

export const metadata: Metadata = {
  title: {
    default: 'PulseWatch — API monitoring and incident management',
    template: '%s · PulseWatch',
  },
  description:
    'Monitor API availability, response times, and incidents with honest, observation-based reporting.',
  applicationName: 'PulseWatch',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <AppFrame>{children}</AppFrame>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
