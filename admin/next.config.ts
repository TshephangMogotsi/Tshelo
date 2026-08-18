import type { NextConfig } from 'next'
import path from 'node:path'

const repositoryRoot = path.resolve(process.cwd(), '..')

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingRoot: repositoryRoot,
  poweredByHeader: false,
  typedRoutes: true,
  turbopack: {
    root: repositoryRoot,
  },
}

export default nextConfig
