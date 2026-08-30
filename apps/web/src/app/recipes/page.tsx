'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { ChefHatIcon, Clock3Icon, PlusIcon, SaladIcon, UsersIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/page-header'
import { StatusAlert } from '@/components/status-alert'
import { api, problemMessage } from '@/lib/api'
import { Badge } from '@family-os/ui/components/badge'
import { Button } from '@family-os/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@family-os/ui/components/card'
import { Input } from '@family-os/ui/components/input'
import { Label } from '@family-os/ui/components/label'
import { Textarea } from '@family-os/ui/components/textarea'

type Ingredient = { id: string; name: string; unit: string | null }
type Recipe = { id: string; title: string; cookingMinutes: number; servings: number; steps: string[] }

export default function RecipesPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState('')
  const ingredientRef = useRef<HTMLFormElement>(null)
  const recipeRef = useRef<HTMLFormElement>(null)
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
    const formEl = ingredientRef.current
    if (!formEl) return
    const form = new FormData(formEl)
    try {
      await api('/ingredients', {
        method: 'POST',
        body: JSON.stringify({ name: String(form.get('name')), unit: String(form.get('unit') || '') || null }),
      })
      formEl.reset()
      setError('')
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  async function addRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formEl = recipeRef.current
    if (!formEl) return
    const form = new FormData(formEl)
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
      formEl.reset()
      setError('')
      await refresh()
    } catch (err) {
      setError(problemMessage(err))
    }
  }
  return (
    <AppShell>
      <PageHeader title="食材与菜谱" description="先维护常用食材，再把经常做的菜记录成可复用菜谱。" />
      <StatusAlert error={error} />
      <div className="grid gap-4 @2xl/main:grid-cols-2">
        <form ref={ingredientRef} method="post" onSubmit={addIngredient}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SaladIcon className="size-5" />新食材</CardTitle>
              <CardDescription>记录食材名称和常用计量单位。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ingredient-name">名称</Label>
                  <Input id="ingredient-name" name="name" placeholder="例如：西红柿" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ingredient-unit">单位</Label>
                  <Input id="ingredient-unit" name="unit" placeholder="例如：g / 个" />
                </div>
              </div>
              <Button type="submit" className="w-fit"><PlusIcon />添加食材</Button>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {ingredients.length ? ingredients.map((item) => (
                  <Badge key={item.id} variant="secondary">{item.name}{item.unit ? ` · ${item.unit}` : ''}</Badge>
                )) : <span className="text-sm text-muted-foreground">暂无食材</span>}
              </div>
            </CardContent>
          </Card>
        </form>
        <form ref={recipeRef} method="post" onSubmit={addRecipe}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ChefHatIcon className="size-5" />新菜谱</CardTitle>
              <CardDescription>记录份量、预计用时和清晰的制作步骤。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="recipe-title">菜名</Label>
                <Input id="recipe-title" name="title" placeholder="例如：番茄炒蛋" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="cooking-minutes">烹饪时间（分钟）</Label>
                  <Input id="cooking-minutes" name="cookingMinutes" type="number" min={1} defaultValue={20} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="servings">份量（人）</Label>
                  <Input id="servings" name="servings" type="number" min={1} defaultValue={2} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="recipe-steps">制作步骤</Label>
                <Textarea id="recipe-steps" name="steps" rows={5} placeholder="每行一个步骤" required />
              </div>
              <Button type="submit" className="w-fit"><PlusIcon />添加菜谱</Button>
            </CardContent>
          </Card>
        </form>
      </div>
      <section className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {recipes.map((recipe) => (
          <Card key={recipe.id}>
            <CardHeader>
              <CardTitle>{recipe.title}</CardTitle>
              <CardDescription className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1"><Clock3Icon className="size-3.5" />{recipe.cookingMinutes} 分钟</span>
                <span className="inline-flex items-center gap-1"><UsersIcon className="size-3.5" />{recipe.servings} 人份</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
              {recipe.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
              </ol>
            </CardContent>
          </Card>
        ))}
        {recipes.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            还没有菜谱，从上方添加第一道家常菜。
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
