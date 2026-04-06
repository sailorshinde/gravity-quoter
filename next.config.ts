import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow larger file uploads for PDFs
    },
  },
};

export default nextConfig;
