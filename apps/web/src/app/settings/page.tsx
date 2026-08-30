'use client'

import { FormEvent, useState } from 'react'
import { KeyRoundIcon, SaveIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'

export default function SettingsPage() {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (newPassword !== confirmation) {
      setError('两次输入的新密码不一致')
      setMessage('')
      return
    }
    setSubmitting(true)
    try {
      await api('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      form.reset()
      setError('')
      setMessage('密码已修改，其他设备上的登录会话已退出。')
    } catch (err) {
      setMessage('')
      setError(problemMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="账号设置" description="管理当前账号的安全信息。" />
      <StatusAlert error={error} message={message} />
      <form className="max-w-xl" onSubmit={changePassword}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRoundIcon className="size-5" />修改密码</CardTitle>
            <CardDescription>密码长度为 12–200 个字符。修改后保留当前登录，退出其他设备。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">当前密码</Label>
              <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">再次输入新密码</Label>
              <Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
            </div>
            <Button type="submit" className="w-fit" disabled={submitting}>
              <SaveIcon />
              {submitting ? '修改中…' : '修改密码'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppShell>
  )
}
