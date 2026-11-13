import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PingPulse - Uptime Monitoring Dashboard',
  description: 'Theo dõi tình trạng hoạt động và độ trễ website thời gian thực',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
