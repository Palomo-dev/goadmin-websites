import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Sitio Web | Powered by GO Admin',
    template: '%s | GO Admin'
  },
  description: 'Plataforma de sitios web para negocios',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Sitio Web | GO Admin',
    description: 'Plataforma de sitios web para negocios',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sitio Web | GO Admin',
    description: 'Plataforma de sitios web para negocios',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
