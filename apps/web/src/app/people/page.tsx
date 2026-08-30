'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArchiveIcon, UserPlusIcon, UsersRoundIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Badge } from '@family-os/ui/components/badge'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@family-os/ui/components/native-select'

type Person = { id: string; name: string; sex: string | null; version: number; birth: { year: number } | null }

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  async function refresh() {
    setPeople(await api<Person[]>('/people'))
  }
  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = formRef.current
    if (!formEl) return
    const form = new FormData(formEl)
    try {
      await api('/people', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          sex: form.get('sex') || null,
          birth: null,
        }),
      })
      formEl.reset()
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function archive(id: string) {
    try {
      await api(`/people/${id}`, { method: 'DELETE' })
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <PageHeader title="家庭人物" description="登记家庭成员，为账号、用餐和未来的家庭记录提供统一身份。" />
      <StatusAlert error={error} />
      <Card>
        <CardHeader>
          <CardTitle>登记人物</CardTitle>
          <CardDescription>姓名为必填项，其他资料可以之后补充。</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end" method="post" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="person-name">姓名</Label>
              <Input id="person-name" name="name" placeholder="例如：妈妈" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="person-sex">性别</Label>
              <NativeSelect id="person-sex" name="sex" defaultValue="" className="w-full">
                <NativeSelectOption value="">未填写</NativeSelectOption>
                <NativeSelectOption value="female">女</NativeSelectOption>
                <NativeSelectOption value="male">男</NativeSelectOption>
                <NativeSelectOption value="other">其他</NativeSelectOption>
                <NativeSelectOption value="unknown">未知</NativeSelectOption>
              </NativeSelect>
            </div>
            <Button type="submit">
              <UserPlusIcon />
              登记
            </Button>
          </form>
        </CardContent>
      </Card>
      <section className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {people.map((person) => (
          <Card key={person.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-muted">
                  <UsersRoundIcon className="size-4" />
                </span>
                {person.name}
              </CardTitle>
              <CardDescription>{person.birth?.year ? `${person.birth.year} 年出生` : '未填写出生年份'}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant="secondary">{person.sex ?? '未填写性别'} · v{person.version}</Badge>
              <Button variant="outline" size="sm" type="button" onClick={() => archive(person.id)}>
                <ArchiveIcon />
                归档
              </Button>
            </CardContent>
          </Card>
        ))}
        {people.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            还没有家庭人物，从上方登记第一位成员。
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
