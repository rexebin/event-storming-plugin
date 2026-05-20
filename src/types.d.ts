// Type definitions for D3 in content scripts
declare const d3: typeof import('d3');

declare module '*.md?raw' {
  const content: string;
  export default content;
}
