'use client'

import Link from 'next/link'
import { ClipboardCheckIcon, CookingPotIcon, SaladIcon, UsersRoundIcon } from 'lucide-react'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@family-os/ui/components/card'
import { Badge } from '@family-os/ui/components/badge'

type Counts = { people: number; recipes: number; meals: number; tasks: number }

const sections = [
  { key: 'people', title: '家庭人物', href: '/people', icon: UsersRoundIcon, hint: '维护家庭成员资料' },
  { key: 'recipes', title: '菜谱', href: '/recipes', icon: SaladIcon, hint: '整理食材与做法' },
  { key: 'meals', title: '用餐记录', href: '/meals', icon: CookingPotIcon, hint: '规划并确认用餐' },
  { key: 'tasks', title: '家庭任务', href: '/tasks', icon: ClipboardCheckIcon, hint: '记录待办与完成情况' },
] as const

export function SectionCards({ counts }: { counts: Counts | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {sections.map((section) => {
        const Icon = section.icon
        return (
          <Link key={section.key} href={section.href} className="group outline-none">
            <Card className="@container/card h-full bg-linear-to-t from-primary/5 to-card shadow-xs transition group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-3 group-focus-visible:ring-ring/30">
              <CardHeader>
                <CardDescription>{section.title}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {counts?.[section.key] ?? '—'}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="size-8 p-0">
                    <Icon />
                    <span className="sr-only">{section.title}</span>
                  </Badge>
                </CardAction>
                <p className="text-sm text-muted-foreground">{section.hint}</p>
              </CardHeader>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
