import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['erp.mistercontador.cl', 'localhost:3000'],
    },
  },
  async rewrites() {
    return [
      {
        source: '/inventario',
        destination: '/inventario/index.html',
      },
      {
        source: '/inventario/',
        destination: '/inventario/index.html',
      },
    ]
  },
}

export default nextConfig
