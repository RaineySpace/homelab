import { CircleCheckIcon, CircleXIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@family-os/ui/components/alert'

export function StatusAlert({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleXIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (message) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
        <CircleCheckIcon className="text-emerald-600" />
        <AlertDescription className="text-emerald-800">{message}</AlertDescription>
      </Alert>
    )
  }

  return null
}
