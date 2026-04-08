/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://www.notion.so https://*.notion.so https://www.notion.site https://*.notion.site",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
