'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type Person = { id: string; name: string }
type Draft = { id: string; explanation: string | null; recipes: Array<{ title: string }> }
type Meal = { id: string; status: string; mealType: string; recipes: Array<{ title: string }> }

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
    await api(`/meal-drafts/${draft.id}/confirm`, { method: 'POST' })
    setDraft(null)
    await refresh()
  }
  async function complete(id: string) {
    await api(`/meals/${id}/complete`, { method: 'POST' })
    await refresh()
  }
  return (
    <AppShell>
      <h1>配餐与用餐</h1>
      {error ? <p className="error">{error}</p> : null}
      <form className="panel row" method="post" onSubmit={compose}>
        <select name="mealType" defaultValue="dinner">
          <option value="breakfast">早餐</option>
          <option value="lunch">午餐</option>
          <option value="dinner">晚餐</option>
          <option value="snack">加餐</option>
        </select>
        <select name="diner" required>
          <option value="">用餐人</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
        <input name="maxCookingMinutes" type="number" defaultValue={40} />
        <button className="btn" type="submit">生成草稿</button>
      </form>
      {draft ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>草稿</h2>
          <p>{draft.explanation}</p>
          <p>{draft.recipes.map((item) => item.title).join('、') || '没有选出菜谱'}</p>
          <button className="btn" type="button" onClick={confirm}>确认成正式用餐</button>
        </section>
      ) : null}
      <div className="cards" style={{ marginTop: 16 }}>
        {meals.map((meal) => (
          <article className="card" key={meal.id}>
            <h2>{meal.mealType}</h2>
            <p className="muted">{meal.status} · {meal.recipes.map((item) => item.title).join('、')}</p>
            {meal.status !== 'completed' ? (
              <button className="btn secondary" type="button" onClick={() => complete(meal.id)}>完成用餐</button>
            ) : null}
          </article>
        ))}
      </div>
    </AppShell>
  )
}
