// Shared vite-svg-loader svgo config for the Icon component's
// `*.svg?component` imports, used by every config that compiles the
// components from source (package build, vitest, docs site).
// Keep the viewBox (svgo's default preset strips it) and drop width/height
// so icons scale to their container.
export const iconSvgoConfig = {
  plugins: [
    {
      name: "preset-default",
      params: { overrides: { removeViewBox: false } },
    },
    "removeDimensions",
  ],
};
