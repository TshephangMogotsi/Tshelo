import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const inter = localFont({
  src: '../public/fonts/Inter-GF-latin-variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = localFont({
  src: '../public/fonts/Fraunces-GF-latin-variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-fraunces',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Tshelo Admin',
    template: '%s · Tshelo Admin',
  },
  description: 'Secure operations dashboard for the Tshelo platform.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  )
}
