'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CheckIcon, ChefHatIcon, CookingPotIcon, SparklesIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Badge } from '@family-os/ui/components/badge'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@family-os/ui/components/native-select'

type Person = { id: string; name: string }
type Draft = { id: string; explanation: string | null; recipes: Array<{ title: string }> }
type Meal = { id: string; status: string; mealType: string; recipes: Array<{ title: string }> }

const mealTypeLabels: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export default function MealsPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  async function refresh() {
    const [plist, mlist] = await Promise.all([api<Person[]>('/people'), api<Meal[]>('/meals')])
    setPeople(plist)
    setMeals(mlist)
  }
  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])
  async function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = event.currentTarget
    const form = new FormData(formEl)
    try {
      const created = await api<Draft>('/meal-drafts', {
        method: 'POST',
        body: JSON.stringify({
          mealType: form.get('mealType'),
          dinerPersonIds: [String(form.get('diner'))],
          mode: 'normal',
          maxCookingMinutes: Number(form.get('maxCookingMinutes')),
          selectionMode: 'agent',
        }),
      })
      setDraft(created)
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function confirm() {
    if (!draft) return
    try {
      await api(`/meal-drafts/${draft.id}/confirm`, { method: 'POST' })
      setDraft(null)
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function complete(id: string) {
    try {
      await api(`/meals/${id}/complete`, { method: 'POST' })
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <PageHeader title="配餐与用餐" description="选择用餐人和可用时间，由家庭助手从已有菜谱中生成一份建议。" />
      <StatusAlert error={error} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SparklesIcon className="size-5" />生成配餐草稿</CardTitle>
          <CardDescription>草稿确认后才会成为正式用餐记录。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 @3xl/main:grid-cols-[180px_minmax(180px,1fr)_180px_auto] @3xl/main:items-end" method="post" onSubmit={compose}>
            <div className="grid gap-2">
              <Label htmlFor="meal-type">餐次</Label>
              <NativeSelect id="meal-type" name="mealType" defaultValue="dinner" className="w-full">
                <NativeSelectOption value="breakfast">早餐</NativeSelectOption>
                <NativeSelectOption value="lunch">午餐</NativeSelectOption>
                <NativeSelectOption value="dinner">晚餐</NativeSelectOption>
                <NativeSelectOption value="snack">加餐</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meal-diner">用餐人</Label>
              <NativeSelect id="meal-diner" name="diner" required className="w-full">
                <NativeSelectOption value="">请选择</NativeSelectOption>
                {people.map((person) => (
                  <NativeSelectOption key={person.id} value={person.id}>{person.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meal-minutes">最多烹饪分钟</Label>
              <Input id="meal-minutes" name="maxCookingMinutes" type="number" min={1} defaultValue={40} />
            </div>
            <Button type="submit"><SparklesIcon />生成草稿</Button>
          </form>
        </CardContent>
      </Card>
      {draft ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ChefHatIcon className="size-5" />本次配餐草稿</CardTitle>
            <CardDescription>{draft.explanation || '已根据当前条件生成。'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {draft.recipes.length ? draft.recipes.map((item) => <Badge key={item.title}>{item.title}</Badge>) : <span className="text-sm text-muted-foreground">没有选出菜谱</span>}
          </CardContent>
          <CardFooter>
            <Button type="button" onClick={confirm}><CheckIcon />确认成正式用餐</Button>
          </CardFooter>
        </Card>
      ) : null}
      <section className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {meals.map((meal) => (
          <Card key={meal.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CookingPotIcon className="size-5" />{mealTypeLabels[meal.mealType] ?? meal.mealType}</CardTitle>
              <CardDescription>{meal.recipes.map((item) => item.title).join('、') || '未关联菜谱'}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant={meal.status === 'completed' ? 'secondary' : 'outline'}>
                {meal.status === 'completed' ? '已完成' : '进行中'}
              </Badge>
            {meal.status !== 'completed' ? (
                <Button variant="outline" size="sm" type="button" onClick={() => complete(meal.id)}><CheckIcon />完成用餐</Button>
            ) : null}
            </CardContent>
          </Card>
        ))}
        {meals.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            还没有用餐记录，可以先生成一份配餐草稿。
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
