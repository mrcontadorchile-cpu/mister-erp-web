import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['erp.mistercontador.cl', 'localhost:3000'],
    },
  },
  async headers() {
    return [
      {
        source: '/inventario/flutter_service_worker.js',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/inventario/flutter_bootstrap.js',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/inventario/index.html',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/inventario/main.dart.js',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ]
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
