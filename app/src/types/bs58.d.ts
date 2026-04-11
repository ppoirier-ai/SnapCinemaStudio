declare module 'bs58' {
  const bs58: {
    encode(data: Uint8Array | Buffer | number[]): string
    decode(s: string): Buffer
  }
  export default bs58
}
