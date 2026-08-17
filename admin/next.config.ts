import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  typedRoutes: true,
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
