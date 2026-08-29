import { loadEnv } from '../env.js'
import { applyMigrations, createDb, createSqlite } from '../core/database/client.js'
import { resetOwnerPassword } from '../modules/accounts.js'

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('该命令必须在交互式 TTY 中运行')
  }
  process.stdout.write(prompt)
  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    const onData = (chunk: string | Buffer) => {
      for (const char of String(chunk)) {
        if (char === '\u0003') {
          cleanup()
          process.stdout.write('\n')
          reject(new Error('已取消'))
          return
        }
        if (char === '\r' || char === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === '\u007f') {
          value = value.slice(0, -1)
          continue
        }
        if (char >= ' ') value += char
      }
    }
    process.stdin.on('data', onData)
  })
}

async function main() {
  const first = await readHidden('请输入 owner 新密码（12–200 个字符）：')
  const second = await readHidden('请再次输入新密码：')
  if (first !== second) throw new Error('两次输入的密码不一致')

  const env = loadEnv()
  const sqlite = createSqlite(env)
  try {
    applyMigrations(sqlite)
    const db = createDb(sqlite)
    resetOwnerPassword(db, first)
    process.stdout.write('owner 密码已重置，全部旧会话已撤销。\n')
  } finally {
    sqlite.close()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`重置失败：${message}\n`)
  process.exitCode = 1
})
