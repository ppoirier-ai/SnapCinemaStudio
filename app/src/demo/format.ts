import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function lamportsToSol(l: bigint): string {
  const whole = l / BigInt(LAMPORTS_PER_SOL)
  const frac = l % BigInt(LAMPORTS_PER_SOL)
  return `${whole}.${frac.toString().padStart(9, '0').replace(/0+$/, '') || '0'}`
}
