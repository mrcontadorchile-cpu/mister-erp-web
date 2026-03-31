import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mister Contabilidad — ERP',
  description: 'Sistema de contabilidad chilena para Pymes — Mister Group',
  icons: { icon: '/favicon.ico' },
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
