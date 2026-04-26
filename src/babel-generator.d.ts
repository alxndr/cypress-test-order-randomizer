// Minimal ambient declaration for @babel/generator.
//
// The package ships CJS without bundled TypeScript types, and the DefinitelyTyped
// package (@types/babel__generator) is incompatible with moduleResolution:NodeNext
// because its package.json has "main": "" and no exports field. This declaration
// provides just enough typing for our usage.
declare module '@babel/generator' {
  import type { Node } from '@babel/types'
  function generate(ast: Node): { code: string; map?: unknown }
  export default generate
}
