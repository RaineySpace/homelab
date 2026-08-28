import { and, desc, eq, isNull } from 'drizzle-orm'
import { createRoute, z } from '@hono/zod-openapi'
import { createRouter } from '../core/router.js'
import { ingredients, recipeIngredients, recipes } from '../core/database/schema.js'
import { Errors } from '../core/errors.js'
import { createId, nowIso } from '../core/ids.js'
import { withIdempotency } from '../core/idempotency.js'
import { writeAudit } from '../core/audit.js'
import { errorResponses, jsonContent } from '../core/openapi.js'
import { hasPermission } from '../core/permissions.js'
import type { CommandContext } from '../core/context.js'
import type { Db } from '../core/database/client.js'

const IngredientResponseSchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    unit: z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Ingredient')

const RecipeIngredientInputSchema = z.strictObject({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  note: z.string().max(200).nullable().optional(),
})

const RecipeIngredientResponseSchema = RecipeIngredientInputSchema.extend({
  name: z.string(),
}).openapi('RecipeIngredient')

const RecipeResponseSchema = z
  .strictObject({
    id: z.string(),
    title: z.string(),
    cookingMinutes: z.number().int(),
    servings: z.number().int(),
    steps: z.array(z.string()),
    ingredients: z.array(RecipeIngredientResponseSchema),
    version: z.number().int(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Recipe')

const CreateIngredientRequestSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(50),
    unit: z.string().trim().min(1).max(20).nullable(),
  })
  .openapi('CreateIngredientRequest')

const CreateRecipeRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(80),
    cookingMinutes: z.number().int().positive().max(24 * 60),
    servings: z.number().int().positive().max(50),
    steps: z.array(z.string().trim().min(1)).min(1),
    ingredients: z.array(RecipeIngredientInputSchema).default([]),
  })
  .openapi('CreateRecipeRequest')

const UpdateRecipeRequestSchema = CreateRecipeRequestSchema.extend({
  version: z.number().int().positive(),
}).openapi('UpdateRecipeRequest')

function requirePerm(ctx: CommandContext, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(ctx.identity, permission)) throw Errors.forbidden()
}

function toIngredient(row: typeof ingredients.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function recipeIngredientsOf(db: Db, recipeId: string) {
  return db
    .select({
      ingredientId: recipeIngredients.ingredientId,
      quantity: recipeIngredients.quantity,
      note: recipeIngredients.note,
      name: ingredients.name,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .all()
}

function toRecipe(db: Db, row: typeof recipes.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    cookingMinutes: row.cookingMinutes,
    servings: row.servings,
    steps: JSON.parse(row.stepsJson) as string[],
    ingredients: recipeIngredientsOf(db, row.id).map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      note: item.note,
      name: item.name,
    })),
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function assertIngredients(db: Db, ctx: CommandContext, ids: string[]) {
  for (const id of ids) {
    const row = db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, id), eq(ingredients.householdId, ctx.identity.householdId), isNull(ingredients.archivedAt)))
      .get()
    if (!row) throw Errors.validation('食材不存在或已归档', [{ path: ['ingredients'], code: 'invalid', message: `找不到食材 ${id}` }])
  }
}

function replaceRecipeIngredients(
  db: Db,
  recipeId: string,
  items: z.infer<typeof RecipeIngredientInputSchema>[],
) {
  db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)).run()
  for (const item of items) {
    db.insert(recipeIngredients)
      .values({
        id: createId('ring'),
        recipeId,
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        note: item.note ?? null,
      })
      .run()
  }
}

export function listIngredientsCommand(db: Db, ctx: CommandContext) {
  requirePerm(ctx, 'ingredients:read')
  return db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.householdId, ctx.identity.householdId), isNull(ingredients.archivedAt)))
    .orderBy(ingredients.name)
    .all()
    .map(toIngredient)
}

export function createIngredientCommand(
  db: Db,
  ctx: CommandContext,
  input: z.infer<typeof CreateIngredientRequestSchema>,
) {
  requirePerm(ctx, 'ingredients:create')
  return withIdempotency(db, ctx, 'ingredients.create', input, () => {
    const at = nowIso()
    const id = createId('ing')
    try {
      db.insert(ingredients)
        .values({
          id,
          householdId: ctx.identity.householdId,
          name: input.name,
          unit: input.unit,
          archivedAt: null,
          createdAt: at,
          updatedAt: at,
        })
        .run()
    } catch {
      throw Errors.conflict('INGREDIENT_NAME_TAKEN', '食材已存在', `家庭中已有名为「${input.name}」的食材`)
    }
    writeAudit(db, ctx, { command: 'ingredients.create', entityType: 'ingredient', entityId: id })
    return toIngredient(db.select().from(ingredients).where(eq(ingredients.id, id)).get()!)
  })
}

export function listRecipesCommand(db: Db, ctx: CommandContext, includeArchived = false) {
  requirePerm(ctx, 'recipes:read')
  return db
    .select()
    .from(recipes)
    .where(eq(recipes.householdId, ctx.identity.householdId))
    .orderBy(desc(recipes.createdAt))
    .all()
    .filter((row) => includeArchived || !row.archivedAt)
    .map((row) => toRecipe(db, row))
}

export function getRecipeCommand(db: Db, ctx: CommandContext, recipeId: string) {
  requirePerm(ctx, 'recipes:read')
  const row = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.householdId, ctx.identity.householdId)))
    .get()
  if (!row) throw Errors.notFound('菜谱不存在', '找不到该菜谱')
  return toRecipe(db, row)
}

export function createRecipeCommand(
  db: Db,
  ctx: CommandContext,
  input: z.infer<typeof CreateRecipeRequestSchema>,
) {
  requirePerm(ctx, 'recipes:create')
  return withIdempotency(db, ctx, 'recipes.create', input, () => {
    assertIngredients(db, ctx, input.ingredients.map((item) => item.ingredientId))
    const at = nowIso()
    const id = createId('recipe')
    db.insert(recipes)
      .values({
        id,
        householdId: ctx.identity.householdId,
        title: input.title,
        cookingMinutes: input.cookingMinutes,
        servings: input.servings,
        stepsJson: JSON.stringify(input.steps),
        version: 1,
        archivedAt: null,
        createdAt: at,
        updatedAt: at,
      })
      .run()
    replaceRecipeIngredients(db, id, input.ingredients)
    writeAudit(db, ctx, { command: 'recipes.create', entityType: 'recipe', entityId: id })
    return getRecipeCommand(db, ctx, id)
  })
}

export function updateRecipeCommand(
  db: Db,
  ctx: CommandContext,
  recipeId: string,
  input: z.infer<typeof UpdateRecipeRequestSchema>,
) {
  requirePerm(ctx, 'recipes:update')
  const current = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.householdId, ctx.identity.householdId)))
    .get()
  if (!current || current.archivedAt) throw Errors.notFound('菜谱不存在', '找不到该菜谱')
  if (current.version !== input.version) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '菜谱已被其他人更新，请刷新后再试')
  }
  assertIngredients(db, ctx, input.ingredients.map((item) => item.ingredientId))
  const at = nowIso()
  const updated = db
    .update(recipes)
    .set({
      title: input.title,
      cookingMinutes: input.cookingMinutes,
      servings: input.servings,
      stepsJson: JSON.stringify(input.steps),
      version: current.version + 1,
      updatedAt: at,
    })
    .where(and(eq(recipes.id, recipeId), eq(recipes.version, input.version)))
    .returning()
    .all()
  if (updated.length === 0) {
    throw Errors.conflict('ENTITY_VERSION_CONFLICT', '版本冲突', '菜谱已被其他人更新，请刷新后再试')
  }
  replaceRecipeIngredients(db, recipeId, input.ingredients)
  writeAudit(db, ctx, { command: 'recipes.update', entityType: 'recipe', entityId: recipeId })
  return getRecipeCommand(db, ctx, recipeId)
}

export function archiveRecipeCommand(db: Db, ctx: CommandContext, recipeId: string) {
  requirePerm(ctx, 'recipes:archive')
  const current = getRecipeCommand(db, ctx, recipeId)
  if (current.archivedAt) return current
  const at = nowIso()
  db.update(recipes)
    .set({ archivedAt: at, updatedAt: at })
    .where(and(eq(recipes.id, recipeId), eq(recipes.householdId, ctx.identity.householdId)))
    .run()
  writeAudit(db, ctx, { command: 'recipes.archive', entityType: 'recipe', entityId: recipeId })
  return getRecipeCommand(db, ctx, recipeId)
}

function commandCtx(c: { get: (k: 'identity' | 'requestId') => unknown }, key?: string): CommandContext {
  return {
    identity: c.get('identity') as CommandContext['identity'],
    requestId: c.get('requestId') as string,
    source: 'manual',
    idempotencyKey: key,
  }
}

export function recipeRoutes() {
  const routes = createRouter()

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/ingredients',
      tags: ['Recipes'],
      responses: { 200: jsonContent(z.array(IngredientResponseSchema), '食材列表'), ...errorResponses },
    }),
    (c) => c.json(listIngredientsCommand(c.get('db'), commandCtx(c)), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/ingredients',
      tags: ['Recipes'],
      request: { body: jsonContent(CreateIngredientRequestSchema, '创建食材') },
      responses: { 201: jsonContent(IngredientResponseSchema, '已创建'), ...errorResponses },
    }),
    (c) => {
      const created = createIngredientCommand(
        c.get('db'),
        commandCtx(c, c.req.header('Idempotency-Key') ?? undefined),
        c.req.valid('json'),
      )
      return c.json(created, 201)
    },
  )

  routes.openapi(
    createRoute({
      method: 'get',
      path: '/recipes',
      tags: ['Recipes'],
      responses: { 200: jsonContent(z.array(RecipeResponseSchema), '菜谱列表'), ...errorResponses },
    }),
    (c) => c.json(listRecipesCommand(c.get('db'), commandCtx(c)), 200),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/recipes',
      tags: ['Recipes'],
      request: { body: jsonContent(CreateRecipeRequestSchema, '创建菜谱') },
      responses: { 201: jsonContent(RecipeResponseSchema, '已创建'), ...errorResponses },
    }),
    (c) =>
      c.json(
        createRecipeCommand(
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
      path: '/recipes/{recipeId}',
      tags: ['Recipes'],
      request: {
        params: z.strictObject({
          recipeId: z.string().openapi({ param: { name: 'recipeId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(RecipeResponseSchema, '菜谱'), ...errorResponses },
    }),
    (c) => c.json(getRecipeCommand(c.get('db'), commandCtx(c), c.req.valid('param').recipeId), 200),
  )

  routes.openapi(
    createRoute({
      method: 'patch',
      path: '/recipes/{recipeId}',
      tags: ['Recipes'],
      request: {
        params: z.strictObject({
          recipeId: z.string().openapi({ param: { name: 'recipeId', in: 'path' } }),
        }),
        body: jsonContent(UpdateRecipeRequestSchema, '更新菜谱'),
      },
      responses: { 200: jsonContent(RecipeResponseSchema, '已更新'), ...errorResponses },
    }),
    (c) =>
      c.json(
        updateRecipeCommand(c.get('db'), commandCtx(c), c.req.valid('param').recipeId, c.req.valid('json')),
        200,
      ),
  )

  routes.openapi(
    createRoute({
      method: 'post',
      path: '/recipes/{recipeId}/archive',
      tags: ['Recipes'],
      request: {
        params: z.strictObject({
          recipeId: z.string().openapi({ param: { name: 'recipeId', in: 'path' } }),
        }),
      },
      responses: { 200: jsonContent(RecipeResponseSchema, '已归档'), ...errorResponses },
    }),
    (c) => c.json(archiveRecipeCommand(c.get('db'), commandCtx(c), c.req.valid('param').recipeId), 200),
  )

  return routes
}

export const recipeToolSchemas = {
  createIngredient: CreateIngredientRequestSchema,
  createRecipe: CreateRecipeRequestSchema,
}
