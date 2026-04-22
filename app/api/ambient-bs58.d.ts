/** bs58 is CJS; no @types in devDependencies. */
declare module 'bs58' {
  const bs58: {
    (data: string | number[] | Uint8Array): string
    decode(s: string): Uint8Array
  }
  export = bs58
}
