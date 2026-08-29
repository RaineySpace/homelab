import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
})

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  name: text('name').notNull(),
  sex: text('sex'),
  birthYear: integer('birth_year'),
  birthMonth: integer('birth_month'),
  birthDay: integer('birth_day'),
  version: integer('version').notNull().default(1),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const personRevisions = sqliteTable('person_revisions', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  householdId: text('household_id').notNull(),
  version: integer('version').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  actorAccountId: text('actor_account_id').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull(),
})

export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  name: text('name').notNull(),
  unit: text('unit'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  title: text('title').notNull(),
  cookingMinutes: integer('cooking_minutes').notNull(),
  servings: integer('servings').notNull(),
  stepsJson: text('steps_json').notNull(),
  version: integer('version').notNull().default(1),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const recipeIngredients = sqliteTable('recipe_ingredients', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull(),
  ingredientId: text('ingredient_id').notNull(),
  quantity: real('quantity').notNull(),
  note: text('note'),
})

export const mealDrafts = sqliteTable('meal_drafts', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  mealType: text('meal_type').notNull(),
  dinerPersonIdsJson: text('diner_person_ids_json').notNull(),
  mode: text('mode').notNull(),
  maxCookingMinutes: integer('max_cooking_minutes'),
  selectionMode: text('selection_mode').notNull(),
  status: text('status').notNull(),
  recipeIdsJson: text('recipe_ids_json').notNull(),
  explanation: text('explanation'),
  mealId: text('meal_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  mealDraftId: text('meal_draft_id').notNull(),
  mealType: text('meal_type').notNull(),
  dinerPersonIdsJson: text('diner_person_ids_json').notNull(),
  recipeIdsJson: text('recipe_ids_json').notNull(),
  status: text('status').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const mealRatings = sqliteTable('meal_ratings', {
  id: text('id').primaryKey(),
  mealId: text('meal_id').notNull(),
  personId: text('person_id').notNull(),
  score: integer('score').notNull(),
  comment: text('comment'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  title: text('title').notNull(),
  notes: text('notes'),
  assigneePersonId: text('assignee_person_id'),
  dueAt: text('due_at'),
  status: text('status').notNull(),
  completedAt: text('completed_at'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  accountId: text('account_id').notNull(),
  status: text('status').notNull(),
  message: text('message').notNull(),
  errorJson: text('error_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const agentActions = sqliteTable('agent_actions', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  householdId: text('household_id').notNull(),
  tool: text('tool').notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
})

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').notNull(),
  householdId: text('household_id').notNull(),
  accountId: text('account_id').notNull(),
  requestHash: text('request_hash').notNull(),
  statusCode: integer('status_code').notNull(),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull(),
})

export const householdAgentModels = sqliteTable('household_agent_models', {
  householdId: text('household_id').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model'),
  baseUrl: text('base_url'),
  apiKeyCipher: text('api_key_cipher'),
  updatedAt: text('updated_at').notNull(),
})

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  actorAccountId: text('actor_account_id').notNull(),
  source: text('source').notNull(),
  command: text('command').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  detailJson: text('detail_json'),
  createdAt: text('created_at').notNull(),
})
