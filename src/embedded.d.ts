// The kit files built into main.js (see esbuild.config.mjs and scripts/embed-kit.mjs).
declare module "lab-kit-embedded" {
  const kit: import("./kit/managed").EmbeddedKit;
  export default kit;
}
