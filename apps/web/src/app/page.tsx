'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { api } from '@/lib/api'

type Counts = { people: number; recipes: number; meals: number; tasks: number }

export default function HomePage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  useEffect(() => {
    Promise.all([
      api<unknown[]>('/people'),
      api<unknown[]>('/recipes'),
      api<unknown[]>('/meals'),
      api<unknown[]>('/tasks'),
    ]).then(([people, recipes, meals, tasks]) => {
      setCounts({
        people: people.length,
        recipes: recipes.length,
        meals: meals.length,
        tasks: tasks.length,
      })
    })
  }, [])
  return (
    <AppShell>
      <h1>家庭总览</h1>
      <p className="muted">Next.js 只负责呈现；所有家庭事实都由 Hono API 解释和改变。</p>
      <div className="cards">
        {[
          ['人物', counts?.people, '/people'],
          ['菜谱', counts?.recipes, '/recipes'],
          ['用餐', counts?.meals, '/meals'],
          ['任务', counts?.tasks, '/tasks'],
        ].map(([label, value, href]) => (
          <Link key={href} href={String(href)} className="card">
            <div className="muted">{label}</div>
            <h2>{value ?? '…'}</h2>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
