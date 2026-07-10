/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Allow Supabase Storage public images. Replace with your project ref.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
export default nextConfig;
