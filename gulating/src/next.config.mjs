/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // These packages should be treated as external on the server bundle
    serverExternalPackages: [
        "@meshsdk/core",
        "@meshsdk/core-cst",
        "@meshsdk/react",
        "@emurgo/cardano-serialization-lib-nodejs", // ← added
    ],

    webpack: (config) => {
        // Keep existing flags and ensure WASM support is on
        config.experiments = {
            ...(config.experiments || {}),
            asyncWebAssembly: true,
            layers: true,
        };
        return config;
    },
};

export default nextConfig;
