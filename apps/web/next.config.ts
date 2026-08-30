import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const apiOrigin = (process.env.INTERNAL_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
)

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(configDir, '../..'),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['@family-os/api-client', '@family-os/ui'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
