import { createSolanaRpc } from '@solana/rpc'
import type { ClusterUrl } from '@solana/rpc-types'

/** Single-flight RPC (Kit) for Kamino SDK calls, keyed by HTTP endpoint. */
const rpcCache = new Map<string, ReturnType<typeof createSolanaRpc>>()

export function getKaminoKitRpc(rpcEndpoint: string): ReturnType<typeof createSolanaRpc> {
  const hit = rpcCache.get(rpcEndpoint)
  if (hit) return hit
  const rpc = createSolanaRpc(rpcEndpoint as ClusterUrl)
  rpcCache.set(rpcEndpoint, rpc)
  return rpc
}

/** Kamino SDK Rpc typing is stricter than `createSolanaRpc` inference; safe at runtime. */
export function getKaminoKitRpcLoose(rpcEndpoint: string) {
  return getKaminoKitRpc(rpcEndpoint) as never
}
