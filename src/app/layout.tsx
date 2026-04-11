import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ERP Mister Group',
  description: 'Sistema de contabilidad chilena para Pymes — Mister Group',
  icons: { icon: '/favicon.ico' },
  verification: {
    google: 'gNDYv-waFbDNBLembf_ZYp5D-Cr9FU-cXDzUSD8JH1w',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-background text-text-primary">
        {children}
      </body>
    </html>
  )
}
