import type {NextConfig} from 'next';
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
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version,
    NEXT_PUBLIC_GIT_SHA: computedGitSha ?? '',
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
    ],
  },
};

export default nextConfig;
