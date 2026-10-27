/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@pagechime/core"],
  poweredByHeader: false,
};
export default config;
