'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { api, problemMessage } from '@/lib/api'

type Ingredient = { id: string; name: string; unit: string | null }
type Recipe = { id: string; title: string; cookingMinutes: number; servings: number; steps: string[] }

export default function RecipesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState('')
  async function refresh() {
    const [ing, rec] = await Promise.all([api<Ingredient[]>('/ingredients'), api<Recipe[]>('/recipes')])
    setIngredients(ing)
    setRecipes(rec)
  }
  useEffect(() => {
    refresh().catch((err) => setError(problemMessage(err)))
  }, [])
  async function addIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/ingredients', {
        method: 'POST',
        body: JSON.stringify({ name: String(form.get('name')), unit: String(form.get('unit') || '') || null }),
      })
      event.currentTarget.reset()
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function addRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: String(form.get('title')),
          cookingMinutes: Number(form.get('cookingMinutes')),
          servings: Number(form.get('servings')),
          steps: String(form.get('steps'))
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          ingredients: [],
        }),
      })
      event.currentTarget.reset()
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <h1>食材与菜谱</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <form className="panel grid" onSubmit={addIngredient}>
          <h2>新食材</h2>
          <input name="name" placeholder="名称" required />
          <input name="unit" placeholder="单位，如 g / 个" />
          <button className="btn" type="submit">添加食材</button>
          <p className="muted">已有：{ingredients.map((item) => item.name).join('、') || '暂无'}</p>
        </form>
        <form className="panel grid" onSubmit={addRecipe}>
          <h2>新菜谱</h2>
          <input name="title" placeholder="菜名" required />
          <input name="cookingMinutes" type="number" min={1} defaultValue={20} />
          <input name="servings" type="number" min={1} defaultValue={2} />
          <textarea name="steps" rows={4} placeholder="每行一个步骤" required />
          <button className="btn" type="submit">添加菜谱</button>
        </form>
      </div>
      <div className="cards" style={{ marginTop: 16 }}>
        {recipes.map((recipe) => (
          <article className="card" key={recipe.id}>
            <h2>{recipe.title}</h2>
            <p className="muted">{recipe.cookingMinutes} 分钟 · {recipe.servings} 人份</p>
            <ol>
              {recipe.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </AppShell>
  )
}
