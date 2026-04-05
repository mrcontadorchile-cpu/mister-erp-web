import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['erp.mistercontador.cl', 'localhost:3000'],
    },
  },
  async redirects() {
    return [
      // Redirect bare /inventario to /inventario/ so Flutter SPA loads correctly
      {
        source: '/inventario',
        destination: '/inventario/',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
