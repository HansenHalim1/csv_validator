import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Pastikan Anda memiliki file CSS ini, atau hapus baris ini jika belum ada
import { Suspense } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Portal Validasi Literasi Nasional',
  description: 'Aplikasi Client-Side CSV Validator untuk Data Literasi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center text-teal-600 font-medium">
            Memuat aplikasi...
          </div>
        }>
          {children}
        </Suspense>
      </body>
    </html>
  );
}