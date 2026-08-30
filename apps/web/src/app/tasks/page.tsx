'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { CheckIcon, CircleCheckBigIcon, ListTodoIcon, PlusIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Badge } from '@family-os/ui/components/badge'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'

type Task = { id: string; title: string; status: string; completedAt: string | null }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  async function refresh() {
    setTasks(await api<Task[]>('/tasks'))
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
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: String(form.get('title')),
          notes: null,
          assigneePersonId: null,
          dueAt: null,
        }),
      })
      formEl.reset()
      setError('')
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function complete(id: string) {
    try {
      await api(`/tasks/${id}/complete`, { method: 'POST' })
      await refresh()
      setError('')
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <PageHeader title="家庭任务" description="把需要做的事记下来，完成后及时勾掉。" />
      <StatusAlert error={error} />
      <Card>
        <CardHeader>
          <CardTitle>新建任务</CardTitle>
          <CardDescription>一句话写清楚要完成的事情。</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="post" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="task-title">任务内容</Label>
              <Input id="task-title" name="title" placeholder="例如：洗碗" required />
            </div>
            <Button type="submit">
              <PlusIcon />
              创建任务
            </Button>
          </form>
        </CardContent>
      </Card>
      <section className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className={task.status === 'completed' ? 'bg-muted/30' : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {task.status === 'completed' ? <CircleCheckBigIcon className="size-5 text-emerald-600" /> : <ListTodoIcon className="size-5" />}
                {task.title}
              </CardTitle>
              <CardDescription>
                {task.status === 'completed' ? `完成于 ${task.completedAt}` : '等待完成'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant={task.status === 'completed' ? 'secondary' : 'outline'}>
                {task.status === 'completed' ? '已完成' : '待处理'}
              </Badge>
            {task.status !== 'completed' ? (
                <Button variant="outline" size="sm" type="button" onClick={() => complete(task.id)}>
                  <CheckIcon />
                  标记完成
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            当前没有任务，可以安心休息。
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
