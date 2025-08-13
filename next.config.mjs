/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Nếu Netlify báo lỗi về "sharp" khi tối ưu ảnh, bỏ comment dòng dưới:
  // images: { unoptimized: true },
};

export default nextConfig;
