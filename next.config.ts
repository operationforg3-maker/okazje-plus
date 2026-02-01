import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

// Wersja aplikacji i skrót SHA osadzane podczas builda
// Uwaga: NEXT_PUBLIC_* zostanie zinline'owane w bundle po stronie klienta
// Jeśli zmienne środowiskowe nie są ustawione, użyjemy wersji z package.json
// oraz automatycznie wykrytego GIT SHA (lub pusty string, gdy brak repo/CI)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('./package.json');
let computedGitSha = process.env.NEXT_PUBLIC_GIT_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.GITHUB_SHA;
if (!computedGitSha) {
  try {
    // Lazy require by design to avoid issues in some environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('node:child_process');
    computedGitSha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    computedGitSha = '';
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow dev assets fetched from 127.0.0.1
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version,
    NEXT_PUBLIC_GIT_SHA: computedGitSha ?? '',
  },
  // Optimize images for better Core Web Vitals
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year for static images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
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
        hostname: 'ae-pic-a1.aliexpress-media.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Exclude ioredis from client bundle (server-only)
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
  // Compress text for better performance
  compress: true,
  // Generate strict source maps only in dev
  productionBrowserSourceMaps: false,
};

export default withNextIntl(nextConfig);
