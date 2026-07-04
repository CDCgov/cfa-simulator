// Ambient declaration for side-effect CSS imports (e.g. `import "./x.css"`).
// Required since TypeScript 6, which errors (TS2882) on side-effect imports
// without a module declaration.
declare module "*.css";
