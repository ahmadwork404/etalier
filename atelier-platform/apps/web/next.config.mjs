export default {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000") +
          "/api/:path*",
      },
    ];
  },
};
