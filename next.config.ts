import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
  // Nếu Netlify báo lỗi về sharp/image, mở dòng sau:
  // , images: { unoptimized: true }
};

export default nextConfig;
