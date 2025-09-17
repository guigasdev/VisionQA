import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

export const metadata: Metadata = {
  title: 'VisionQA',
  description: 'OCR + IA com Azure/OpenAI',
}

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-brand-50 via-white to-white text-gray-900 antialiased dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 dark:text-gray-100`}> 
        {children}
      </body>
    </html>
  )
} 