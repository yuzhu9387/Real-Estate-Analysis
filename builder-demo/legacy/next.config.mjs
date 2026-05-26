/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const nextConfig = {
  output: 'export',
  basePath: isProd ? '/Real-Estate-Analysis/builder-demo-site' : '',
  assetPrefix: isProd ? '/Real-Estate-Analysis/builder-demo-site/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
