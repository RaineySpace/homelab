import { and, desc, eq } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { mealDrafts, mealRatings, meals, people, recipes } from '../core/database/schema.js'
import { Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { withIdempotency } from '../core/idempotency.js'
import { writeAudit } from '../core/audit.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import { getRecipeCommand, listRecipesCommand } from './recipes.js'
import { getPersonCommand } from './people.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'

const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']).openapi('MealType')

const ComposeMealDraftRequestSchema = z
  .strictObject({
    mealType: MealTypeSchema,
    dinerPersonIds: z.array(z.string()).min(1),
    mode: z.enum(['normal']).default('normal'),
    maxCookingMinutes: z.number().int().positive().max(24 * 60).nullable(),
    selectionMode: z.enum(['agent', 'manual']),
    recipeIds: z.array(z.string()).optional(),
  })
  .openapi('ComposeMealDraftRequest')

const MealDraftResponseSchema = z
  .strictObject({
    id: z.string(),
    mealType: MealTypeSchema,
    dinerPersonIds: z.array(z.string()),
    mode: z.string(),
    maxCookingMinutes: z.number().int().nullable(),
    selectionMode: z.enum(['agent', 'manual']),
    status: z.enum(['draft', 'confirmed']),
    recipeIds: z.array(z.string()),
    recipes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        cookingMinutes: z.number().int(),
      }),
    ),
    explanation: z.string().nullable(),
    mealId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('MealDraft')

const RatingSchema = z
  .strictObject({
    personId: z.string(),
    score: z.number().int().min(1).max(5),
    comment: z.string().max(500).nullable(),
    updatedAt: z.string(),
  })
  .openapi('MealRating')

const MealResponseSchema = z
  .strictObject({
    id: z.string(),
    mealDraftId: z.string(),
    mealType: MealTypeSchema,
    dinerPersonIds: z.array(z.string()),
    recipeIds: z.array(z.string()),
    recipes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        cookingMinutes: z.number().int(),
      }),
    ),
    status: z.enum(['confirmed', 'completed']),
    completedAt: z.string().nullable(),
    ratings: z.array(RatingSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Meal')

const SubmitRatingRequestSchema = z
  .strictObject({
    score: z.number().int().min(1).max(5),
    comment: z.string().max(500).nullable(),
  })
  .openapi('SubmitRatingRequest')

function requirePerm(ctx: CommandContext, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(ctx.identity, permission)) throw Errors.forbidden()
}

function parseIds(json: string): string[] {
  return JSON.parse(json) as string[]
}

function recipeSummaries(db: Db, ctx: CommandContext, ids: string[]) {
  return ids.map((id) => {
    const recipe = getRecipeCommand(db, ctx, id)
    return { id: recipe.id, title: recipe.title, cookingMinutes: recipe.cookingMinutes }
  })
}

function toDraft(db: Db, ctx: CommandContext, row: typeof mealDrafts.$inferSelect) {
  const recipeIds = parseIds(row.recipeIdsJson)
  return {
    id: row.id,
    mealType: row.mealType as z.infer<typeof MealTypeSchema>,
    dinerPersonIds: parseIds(row.dinerPersonIdsJson),
    mode: row.mode,
    maxCookingMinutes: row.maxCookingMinutes,
    selectionMode: row.selectionMode as 'agent' | 'manual',
    status: row.status as 'draft' | 'confirmed',
    recipeIds,
    recipes: recipeSummaries(db, ctx, recipeIds),
    explanation: row.explanation,
    mealId: row.mealId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toMeal(db: Db, ctx: CommandContext, row: typeof meals.$inferSelect) {
  const recipeIds = parseIds(row.recipeIdsJson)
  const ratings = db.select().from(mealRatings).where(eq(mealRatings.mealId, row.id)).all()
  return {
    id: row.id,
    mealDraftId: row.mealDraftId,
    mealType: row.mealType as z.infer<typeof MealTypeSchema>,
    dinerPersonIds: parseIds(row.dinerPersonIdsJson),
    recipeIds,
    recipes: recipeSummaries(db, ctx, recipeIds),
    status: row.status as 'confirmed' | 'completed',
    completedAt: row.completedAt,
    ratings: ratings.map((item) => ({
      personId: item.personId,
      score: item.score,
      comment: item.comment,
      updatedAt: item.updatedAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function assertDiners(db: Db, ctx: CommandContext, ids: string[]) {
  for (const id of ids) {
    const person = getPersonCommand(db, ctx, id)
    if (person.archivedAt) {
      throw Errors.validation('用餐人已归档', [{ path: ['dinerPersonIds'], code: 'archived', message: person.name }])
    }
  }
}

function pickRecipes(db: Db, ctx: CommandContext, maxCookingMinutes: number | null, requested?: string[]) {
  if (requested && requested.length > 0) {
    for (const id of requested) {
      const recipe = getRecipeCommand(db, ctx, id)
      if (recipe.archivedAt) {
        throw Errors.validation('菜谱已归档', [{ path: ['recipeIds'], code: 'archived', message: recipe.title }])
      }
      if (maxCookingMinutes != null && recipe.cookingMinutes > maxCookingMinutes) {
        throw Errors.validation('超出烹饪时长', [
          { path: ['recipeIds'], code: 'too_long', message: `${recipe.title} 需要 ${recipe.cookingMinutes} 分钟` },
        ])
      }
    }
    return { recipeIds: requested, explanation: '按指定菜谱组成草稿' }
  }
  const available = listRecipesCommand(db, ctx).filter(
    (recipe) => maxCookingMinutes == null || recipe.cookingMinutes <= maxCookingMinutes,
  )
  if (available.length === 0) {
    return {
      recipeIds: [] as string[],
      explanation:
        maxCookingMinutes == null
          ? '当前没有未归档菜谱，无法自动配餐'
          : `没有烹饪时间不超过 ${maxCookingMinutes} 分钟的未归档菜谱`,
    }
  }
  const sorted = [...available].sort((a, b) => a.cookingMinutes - b.cookingMinutes)
  const picked = sorted.slice(0, Math.min(2, sorted.length))
  return {
    recipeIds: picked.map((item) => item.id),
    explanation: `按烹饪时长挑选：${picked.map((item) => item.title).join('、')}`,
  }
}

export function composeMealDraftCommand(
  db: Db,
  ctx: CommandContext,
  input: z.infer<typeof ComposeMealDraftRequestSchema>,
) {
  requirePerm(ctx, 'meals:compose')
  if (input.selectionMode === 'manual' && (!input.recipeIds || input.recipeIds.length === 0)) {
    throw Errors.validation('手动配餐必须提供菜谱', [
      { path: ['recipeIds'], code: 'required', message: 'selectionMode=manual 时需要 recipeIds' },
    ])
  }
  assertDiners(db, ctx, input.dinerPersonIds)
  return withIdempotency(db, ctx, 'meals.composeDraft', input, () => {
    const picked = pickRecipes(
      db,
      ctx,
      input.maxCookingMinutes,
      input.selectionMode === 'manual' ? input.recipeIds : undefined,
    )
    const at = nowIso()
    const id = createId('draft')
    db.insert(mealDrafts)
      .values({
        id,
        householdId: ctx.identity.householdId,
        mealType: input.mealType,
        dinerPersonIdsJson: JSON.stringify(input.dinerPersonIds),
        mode: input.mode,
        maxCookingMinutes: input.maxCookingMinutes,
        selectionMode: input.selectionMode,
        status: 'draft',
        recipeIdsJson: JSON.stringify(picked.recipeIds),
        explanation: picked.explanation,
        mealId: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    writeAudit(db, ctx, { command: 'meals.composeDraft', entityType: 'meal_draft', entityId: id })
    return getMealDraftCommand(db, ctx, id)
  })
}

export function getMealDraftCommand(db: Db, ctx: CommandContext, mealDraftId: string) {
  requirePerm(ctx, 'meals:read')
  const row = db
    .select()
    .from(mealDrafts)
    .where(and(eq(mealDrafts.id, mealDraftId), eq(mealDrafts.householdId, ctx.identity.householdId)))
    .get()
  if (!row) throw Errors.notFound('草稿不存在', '找不到该配餐草稿')
  return toDraft(db, ctx, row)
}

export function regenerateMealDraftCommand(db: Db, ctx: CommandContext, mealDraftId: string) {
  requirePerm(ctx, 'meals:compose')
  const current = db
    .select()
    .from(mealDrafts)
    .where(and(eq(mealDrafts.id, mealDraftId), eq(mealDrafts.householdId, ctx.identity.householdId)))
    .get()
  if (!current) throw Errors.notFound('草稿不存在', '找不到该配餐草稿')
  if (current.status !== 'draft') {
    throw Errors.conflict('MEAL_DRAFT_FROZEN', '草稿已确认', '已确认的配餐不能重新生成')
  }
  const picked = pickRecipes(db, ctx, current.maxCookingMinutes, undefined)
  const at = nowIso()
  db.update(mealDrafts)
    .set({
      recipeIdsJson: JSON.stringify(picked.recipeIds),
      explanation: picked.explanation,
      selectionMode: 'agent',
      updatedAt: at,
    })
    .where(eq(mealDrafts.id, mealDraftId))
    .run()
  writeAudit(db, ctx, { command: 'meals.regenerateDraft', entityType: 'meal_draft', entityId: mealDraftId })
  return getMealDraftCommand(db, ctx, mealDraftId)
}

export function confirmMealDraftCommand(db: Db, ctx: CommandContext, mealDraftId: string) {
  requirePerm(ctx, 'meals:confirm')
  return withIdempotency(db, ctx, 'meals.confirmDraft', { mealDraftId }, () => {
    const current = db
      .select()
      .from(mealDrafts)
      .where(and(eq(mealDrafts.id, mealDraftId), eq(mealDrafts.householdId, ctx.identity.householdId)))
      .get()
    if (!current) throw Errors.notFound('草稿不存在', '找不到该配餐草稿')
    if (current.status === 'confirmed' && current.mealId) {
      return getMealCommand(db, ctx, current.mealId)
    }
    const at = nowIso()
    const mealId = createId('meal')
    db.insert(meals)
      .values({
        id: mealId,
        householdId: ctx.identity.householdId,
        mealDraftId,
        mealType: current.mealType,
        dinerPersonIdsJson: current.dinerPersonIdsJson,
        recipeIdsJson: current.recipeIdsJson,
        status: 'confirmed',
        completedAt: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    db.update(mealDrafts)
      .set({ status: 'confirmed', mealId, updatedAt: at })
      .where(eq(mealDrafts.id, mealDraftId))
      .run()
    writeAudit(db, ctx, { command: 'meals.confirmDraft', entityType: 'meal', entityId: mealId })
    return getMealCommand(db, ctx, mealId)
  })
}

export function listMealsCommand(db: Db, ctx: CommandContext) {
  requirePerm(ctx, 'meals:read')
  return db
    .select()
    .from(meals)
    .where(eq(meals.householdId, ctx.identity.householdId))
    .orderBy(desc(meals.createdAt))
    .all()
    .map((row) => toMeal(db, ctx, row))
}

export function getMealCommand(db: Db, ctx: CommandContext, mealId: string) {
  requirePerm(ctx, 'meals:read')
  const row = db
    .select()
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.householdId, ctx.identity.householdId)))
    .get()
  if (!row) throw Errors.notFound('用餐不存在', '找不到该用餐记录')
  return toMeal(db, ctx, row)
}

export function completeMealCommand(db: Db, ctx: CommandContext, mealId: string) {
  requirePerm(ctx, 'meals:complete')
  const current = getMealCommand(db, ctx, mealId)
  if (current.status === 'completed') return current
  const at = nowIso()
  db.update(meals)
    .set({ status: 'completed', completedAt: at, updatedAt: at })
    .where(eq(meals.id, mealId))
    .run()
  writeAudit(db, ctx, { command: 'meals.complete', entityType: 'meal', entityId: mealId })
  return getMealCommand(db, ctx, mealId)
}

export function submitMealRatingCommand(
  db: Db,
  ctx: CommandContext,
  mealId: string,
  personId: string,
  input: z.infer<typeof SubmitRatingRequestSchema>,
) {
  requirePerm(ctx, 'meals:rate')
  return withIdempotency(db, ctx, 'meals.submitRating', { mealId, personId, ...input }, () => {
    const meal = getMealCommand(db, ctx, mealId)
    if (meal.status !== 'completed') {
      throw Errors.conflict('MEAL_NOT_COMPLETED', '用餐尚未完成', '完成用餐后才能评分')
    }
    getPersonCommand(db, ctx, personId)
    if (!meal.dinerPersonIds.includes(personId)) {
      throw Errors.validation('该人物不是本餐用餐人', [
        { path: ['personId'], code: 'not_diner', message: '只能为用餐人评分' },
      ])
    }
    const at = nowIso()
    const existing = db
      .select()
      .from(mealRatings)
      .where(and(eq(mealRatings.mealId, mealId), eq(mealRatings.personId, personId)))
      .get()
    if (existing) {
      db.update(mealRatings)
        .set({ score: input.score, comment: input.comment, updatedAt: at })
        .where(eq(mealRatings.id, existing.id))
        .run()
    } else {
      db.insert(mealRatings)
        .values({
          id: createId('rate'),
          mealId,
          personId,
          score: input.score,
          comment: input.comment,
          createdAt: at,
          updatedAt: at,
        })
        .run()
    }
    writeAudit(db, ctx, { command: 'meals.submitRating', entityType: 'meal', entityId: mealId })
    return getMealCommand(db, ctx, mealId)
  })
}

function commandCtx(c: { get: (k: 'identity' | 'requestId') => unknown }, key?: string): CommandContext {
  return {
    identity: c.get('identity') as CommandContext['identity'],
    requestId: c.get('requestId') as string,
    source: 'manual',
    idempotencyKey: key,
  }
}

export function mealRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/meal-drafts',
      tags: ['Meals'],
      request: { body: jsonContent(ComposeMealDraftRequestSchema, '创建配餐草稿') },
      responses: { 201: jsonContent(MealDraftResponseSchema, '草稿'), ...errorResponses },
    }),
    (c) =>
      c.json(
        composeMealDraftCommand(
          c.get('db'),
          commandCtx(c, c.req.header('Idempotency-Key') ?? undefined),
          c.req.valid('json'),
        ),
        201,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/meal-drafts/{mealDraftId}',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealDraftId: z.string().openapi({ param: { name: 'mealDraftId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(MealDraftResponseSchema, '草稿'), ...errorResponses },
    }),
    (c) => c.json(getMealDraftCommand(c.get('db'), commandCtx(c), c.req.valid('param').mealDraftId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/meal-drafts/{mealDraftId}/regenerate',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealDraftId: z.string().openapi({ param: { name: 'mealDraftId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(MealDraftResponseSchema, '重新生成'), ...errorResponses },
    }),
    (c) => c.json(regenerateMealDraftCommand(c.get('db'), commandCtx(c), c.req.valid('param').mealDraftId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/meal-drafts/{mealDraftId}/confirm',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealDraftId: z.string().openapi({ param: { name: 'mealDraftId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(MealResponseSchema, '正式用餐'), ...errorResponses },
    }),
    (c) =>
      c.json(
        confirmMealDraftCommand(
          c.get('db'),
          commandCtx(c, c.req.header('Idempotency-Key') ?? undefined),
          c.req.valid('param').mealDraftId,
        ),
        200,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/meals',
      tags: ['Meals'],
      responses: { 200: jsonContent(z.array(MealResponseSchema), '用餐列表'), ...errorResponses },
    }),
    (c) => c.json(listMealsCommand(c.get('db'), commandCtx(c)), 200),
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/meals/{mealId}',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealId: z.string().openapi({ param: { name: 'mealId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(MealResponseSchema, '用餐'), ...errorResponses },
    }),
    (c) => c.json(getMealCommand(c.get('db'), commandCtx(c), c.req.valid('param').mealId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/meals/{mealId}/complete',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealId: z.string().openapi({ param: { name: 'mealId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(MealResponseSchema, '已完成'), ...errorResponses },
    }),
    (c) => c.json(completeMealCommand(c.get('db'), commandCtx(c), c.req.valid('param').mealId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'put',
      path: '/meals/{mealId}/ratings/{personId}',
      tags: ['Meals'],
      request: {
        params: z.strictObject({
          mealId: z.string().openapi({ param: { name: 'mealId', in: 'path' } }),
          personId: z.string().openapi({ param: { name: 'personId', in: 'path' } }),
        }),
        body: jsonContent(SubmitRatingRequestSchema, '评分'),
      },
      responses: { 200: jsonContent(MealResponseSchema, '已评分'), ...errorResponses },
    }),
    (c) => {
      const params = c.req.valid('param')
      return c.json(
        submitMealRatingCommand(
          c.get('db'),
          commandCtx(c, c.req.header('Idempotency-Key') ?? undefined),
          params.mealId,
          params.personId,
          c.req.valid('json'),
        ),
        200,
      )
    },
  )

  return routes
}

export const mealToolSchemas = {
  compose: ComposeMealDraftRequestSchema,
}

export { people, recipes }
