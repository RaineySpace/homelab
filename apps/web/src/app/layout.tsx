import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { TooltipProvider } from '@family-os/ui/components/tooltip'
import '@family-os/ui/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Family OS',
  description: '家庭操作系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
