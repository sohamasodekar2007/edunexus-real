
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '082d-103-127-166-105.ngrok-free.app',
        port: '',
        pathname: '/api/files/**', // To match PocketBase file serving structure
      },
    ],
  },
};

export default nextConfig;
