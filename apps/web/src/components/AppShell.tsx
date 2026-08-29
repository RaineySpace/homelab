'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const links = [
  ['/', '总览'],
  ['/people', '人物'],
  ['/recipes', '菜谱'],
  ['/meals', '配餐'],
  ['/tasks', '任务'],
  ['/agent', '助手'],
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<'owner' | 'member' | 'viewer' | null>(null)

  useEffect(() => {
    let active = true
    api<{ role: 'owner' | 'member' | 'viewer' }>('/auth/session')
      .then((session) => {
        if (active) setRole(session.role)
      })
      .catch(() => {
        if (active) router.push('/login')
      })
    return () => {
      active = false
    }
  }, [router])

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Family OS</div>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? 'active' : undefined}>
              {label}
            </Link>
          ))}
          {role === 'owner' ? (
            <Link href="/accounts" className={pathname === '/accounts' ? 'active' : undefined}>
              账号
            </Link>
          ) : null}
          <Link href="/settings" className={pathname === '/settings' ? 'active' : undefined}>
            设置
          </Link>
          <button
            type="button"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' })
              router.push('/login')
            }}
          >
            退出
          </button>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
