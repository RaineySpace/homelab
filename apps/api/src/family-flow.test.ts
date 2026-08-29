import { describe, expect, it } from 'vitest'
import { createTestApp, jsonHeaders, login } from './testing.js'

describe('recipes, meals, tasks', () => {
  it('supports ingredient uniqueness, meal draft confirm, rating after complete, and tasks', async () => {
    const { app } = await createTestApp()
    const { cookie } = await login(app)

    const personRes = await app.request('/api/v1/people', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '爸爸', birth: null, sex: 'male' }),
    })
    const person = (await personRes.json()) as any

    const egg = await app.request('/api/v1/ingredients', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '鸡蛋', unit: 'piece' }),
    })
    expect(egg.status).toBe(201)
    const eggBody = (await egg.json()) as any

    const dup = await app.request('/api/v1/ingredients', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: '鸡蛋', unit: 'piece' }),
    })
    expect(dup.status).toBe(409)

    const recipe = await app.request('/api/v1/recipes', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        title: '番茄炒蛋',
        cookingMinutes: 15,
        servings: 2,
        steps: ['打蛋', '下锅'],
        ingredients: [{ ingredientId: eggBody.id, quantity: 3, note: null }],
      }),
    })
    expect(recipe.status).toBe(201)
    const recipeBody = (await recipe.json()) as any

    const manualFail = await app.request('/api/v1/meal-drafts', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        mealType: 'dinner',
        dinerPersonIds: [person.id],
        mode: 'normal',
        maxCookingMinutes: 40,
        selectionMode: 'manual',
      }),
    })
    expect(manualFail.status).toBe(422)

    const draft = await app.request('/api/v1/meal-drafts', {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'draft-1' }),
      body: JSON.stringify({
        mealType: 'dinner',
        dinerPersonIds: [person.id],
        mode: 'normal',
        maxCookingMinutes: 40,
        selectionMode: 'agent',
      }),
    })
    expect(draft.status).toBe(201)
    const draftBody = (await draft.json()) as any
    expect(draftBody.recipeIds).toContain(recipeBody.id)

    const meal = await app.request(`/api/v1/meal-drafts/${draftBody.id}/confirm`, {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'confirm-1' }),
    })
    expect(meal.status).toBe(200)
    const mealBody = (await meal.json()) as any

    const replay = await app.request(`/api/v1/meal-drafts/${draftBody.id}/confirm`, {
      method: 'POST',
      headers: jsonHeaders(cookie, { 'Idempotency-Key': 'confirm-1' }),
    })
    expect(((await replay.json()) as any).id).toBe(mealBody.id)

    const rateEarly = await app.request(`/api/v1/meals/${mealBody.id}/ratings/${person.id}`, {
      method: 'PUT',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ score: 5, comment: '好吃' }),
    })
    expect(rateEarly.status).toBe(409)

    const completed = await app.request(`/api/v1/meals/${mealBody.id}/complete`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    expect(completed.status).toBe(200)

    const rated = await app.request(`/api/v1/meals/${mealBody.id}/ratings/${person.id}`, {
      method: 'PUT',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ score: 5, comment: '好吃' }),
    })
    expect(rated.status).toBe(200)

    const task = await app.request('/api/v1/tasks', {
      method: 'POST',
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        title: '洗碗',
        notes: null,
        assigneePersonId: person.id,
        dueAt: null,
      }),
    })
    expect(task.status).toBe(201)
    const taskBody = (await task.json()) as any
    const done = await app.request(`/api/v1/tasks/${taskBody.id}/complete`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    const doneBody = (await done.json()) as any
    expect(doneBody.status).toBe('completed')
    expect(doneBody.completedAt).toBeTruthy()
  })
})
