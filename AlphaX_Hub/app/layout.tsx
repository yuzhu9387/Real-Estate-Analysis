import './globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: 'AlphaX Hub' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background text-on-background font-body-md text-body-md selection:bg-primary/20">
        {children}
      </body>
    </html>
  )
}
