import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import RegisterSW from './register-sw';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AP - Truyendich',
  description: 'PWA theo dõi ca truyền',
  manifest: '/manifest.webmanifest',
  themeColor: '#0d6efd',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-light">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
