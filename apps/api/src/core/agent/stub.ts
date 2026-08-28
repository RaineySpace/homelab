import { createId } from '../ids.js'
import type { ModelCompleteInput, ModelCompleteResult, ModelGateway } from './types.js'

export class StubModelGateway implements ModelGateway {
  readonly providerId = 'stub'
  readonly model = 'stub'

  async complete(input: ModelCompleteInput): Promise<ModelCompleteResult> {
    const last = input.messages.at(-1)
    if (last?.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: `已经完成工具调用。结果：${last.content}`,
        },
      }
    }
    const user = [...input.messages].reverse().find((item) => item.role === 'user')
    const text = user?.content ?? ''
    const named = text.match(/叫\s*([^\s的，,。！!？?]{1,20})/)
    if (/创建|登记|添加/.test(text) && (/人物|成员|人/.test(text) || named)) {
      const name = named?.[1] ?? '未命名'
      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: createId('call'),
              function: {
                name: 'people.create',
                arguments: JSON.stringify({ name, birth: null, sex: null }),
              },
            },
          ],
        },
      }
    }
    if (/列出|有哪些/.test(text) && /人/.test(text)) {
      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: createId('call'), function: { name: 'people.list', arguments: '{}' } }],
        },
      }
    }
    if (/归档/.test(text) && /人/.test(text)) {
      const personId = text.match(/person_[a-z0-9]+/)?.[0]
      if (personId) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: createId('call'),
                function: { name: 'people.archive', arguments: JSON.stringify({ personId }) },
              },
            ],
          },
        }
      }
    }
    if (/任务/.test(text) && /创建|添加/.test(text)) {
      const title = text.replace(/.*(?:叫|名为|：|:)/, '').trim() || '未命名任务'
      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: createId('call'),
              function: {
                name: 'tasks.create',
                arguments: JSON.stringify({ title, notes: null, assigneePersonId: null, dueAt: null }),
              },
            },
          ],
        },
      }
    }
    return {
      message: {
        role: 'assistant',
        content: `我是家庭助手。可以说「登记一个叫妈妈的人」或「列出人物」。你刚才说：${text}`,
      },
    }
  }
}
