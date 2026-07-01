import createNextIntlPlugin from 'next-intl/plugin';
import { headers as getHeaders } from './next.config.headers.mjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

let computedGitSha = process.env.NEXT_PUBLIC_GIT_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.GITHUB_SHA;
if (!computedGitSha) {
  try {
    const { execSync } = require('node:child_process');
    computedGitSha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    computedGitSha = '';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version,
    NEXT_PUBLIC_GIT_SHA: computedGitSha ?? '',
  },
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgproxy.convertiser.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.aliexpress-media.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.alicdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '*.alicdn.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ioredis: false,
        dns: false,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },
  compress: true,
  headers: getHeaders,
  productionBrowserSourceMaps: false,
};

export default withNextIntl(nextConfig);
