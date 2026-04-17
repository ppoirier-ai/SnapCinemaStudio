import { PublicKey } from '@solana/web3.js'

const DEFAULT_PLATFORM_OWNER =
  '5m9EpMNkFn13PSFBAmQB16wjBSWnfRKMFPBkEYod5REW'

/** Base58 pubkey; override with `VITE_PLATFORM_OWNER_PUBKEY` for forks. */
export function getPlatformOwnerPubkeyString(): string {
  const fromEnv = import.meta.env.VITE_PLATFORM_OWNER_PUBKEY as
    | string
    | undefined
  if (fromEnv?.trim()) return fromEnv.trim()
  return DEFAULT_PLATFORM_OWNER
}

export function isPlatformOwner(
  publicKey: PublicKey | null | undefined,
): boolean {
  if (!publicKey) return false
  try {
    return publicKey.equals(new PublicKey(getPlatformOwnerPubkeyString()))
  } catch {
    return false
  }
}
