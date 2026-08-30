'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { SectionCards } from '@/components/section-cards'
import { StatusAlert } from '@/components/status-alert'
import { api } from '@/lib/api'

type Counts = { people: number; recipes: number; meals: number; tasks: number }

export default function HomePage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([
      api<unknown[]>('/people'),
      api<unknown[]>('/recipes'),
      api<unknown[]>('/meals'),
      api<unknown[]>('/tasks'),
    ])
      .then(([people, recipes, meals, tasks]) => {
        setCounts({
          people: people.length,
          recipes: recipes.length,
          meals: meals.length,
          tasks: tasks.length,
        })
      })
      .catch(() => setError('暂时无法读取家庭数据，请稍后重试。'))
  }, [])
  return (
    <AppShell>
      <PageHeader
        title="欢迎回家"
        description="在一个地方查看家人、菜谱、用餐计划和待办事项。"
      />
      <StatusAlert error={error} />
      <SectionCards counts={counts} />
    </AppShell>
  )
}
