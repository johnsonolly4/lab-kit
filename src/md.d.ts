// Markdown files are bundled as text (see esbuild.config.mjs).
declare module "*.md" {
  const text: string;
  export default text;
}
