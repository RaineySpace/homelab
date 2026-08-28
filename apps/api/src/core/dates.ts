import { z } from '@hono/zod-openapi'

export const SexSchema = z.enum(['female', 'male', 'other', 'unknown']).openapi('Sex')

export const PartialBirthDateSchema = z
  .strictObject({
    year: z.number().int().min(1800).max(3000),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.day != null && value.month == null) {
      ctx.addIssue({
        code: 'custom',
        message: '日必须伴随月',
        path: ['day'],
      })
      return
    }
    if (value.month != null) {
      const day = value.day ?? 1
      const date = new Date(Date.UTC(value.year, value.month - 1, day))
      if (
        date.getUTCFullYear() !== value.year ||
        date.getUTCMonth() !== value.month - 1 ||
        (value.day != null && date.getUTCDate() !== value.day)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: '出生日期不是有效的自然日',
          path: ['day'],
        })
      }
    }
  })
  .openapi('PartialBirthDate')

export type PartialBirthDate = z.infer<typeof PartialBirthDateSchema>
export type Sex = z.infer<typeof SexSchema>
