
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // Ensure this is false
  },
  eslint: {
    ignoreDuringBuilds: false, // Ensure this is false
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
        pathname