'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { api } from '@/lib/api'
import { SidebarInset, SidebarProvider } from '@family-os/ui/components/sidebar'

export type Session = {
  username: string
  role: 'owner' | 'member' | 'viewer'
  person: { id: string; name: string }
}

const pageTitles: Record<string, string> = {
  '/': '家庭总览',
  '/people': '家庭人物',
  '/recipes': '食材与菜谱',
  '/meals': '配餐与用餐',
  '/tasks': '家庭任务',
  '/agent': '家庭助手',
  '/accounts': '账号管理',
  '/settings': '账号设置',
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let active = true
    api<Session>('/auth/session')
      .then((currentSession) => {
        if (active) setSession(currentSession)
      })
      .catch(() => {
        if (active) router.push('/login')
      })
    return () => {
      active = false
    }
  }, [router])

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar session={session} pathname={pathname} onLogout={logout} variant="inset" />
      <SidebarInset>
        <SiteHeader title={pageTitles[pathname] ?? 'Family OS'} />
        <div className="@container/main flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 px-4 py-5 md:px-6 md:py-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
