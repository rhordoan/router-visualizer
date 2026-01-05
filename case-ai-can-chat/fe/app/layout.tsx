import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HealthChat - Healthcare Virtual Assistant',
  description: 'RAG-powered virtual assistant for healthcare documentation',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}