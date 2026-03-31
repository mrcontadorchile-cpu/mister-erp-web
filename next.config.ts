import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['erp.mistercontador.cl', 'localhost:3000'],
    },
  },
}

export default nextConfig
