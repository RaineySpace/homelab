'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HouseHeartIcon, LogInIcon } from 'lucide-react'
import { api, problemMessage } from '@/lib/api'
import { Alert, AlertDescription } from '@family-os/ui/components/alert'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = event.currentTarget
    const form = new FormData(formEl)
    setSubmitting(true)
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: String(form.get('username') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      })
      router.push('/')
    } catch (err) {
      setError(problemMessage(err))
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-muted/40 p-4">
      <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-primary/8 to-transparent" />
      <form className="relative w-full max-w-sm" method="post" onSubmit={onSubmit}>
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <HouseHeartIcon className="size-5" />
            </span>
            <CardTitle className="text-xl">登录 Family OS</CardTitle>
            <CardDescription>使用你的家庭账号继续</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" name="username" defaultValue="admin" autoComplete="username" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" size="lg" disabled={submitting}>
              <LogInIcon />
              {submitting ? '登录中…' : '进入家庭'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
