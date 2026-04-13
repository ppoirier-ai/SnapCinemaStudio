import { address, type TransactionPartialSigner, type TransactionSigner } from '@solana/kit'
import type { PublicKey } from '@solana/web3.js'

/**
 * Marks the wallet as a signer in Kamino kit instructions; Phantom still signs the full legacy tx.
 */
export function noopSignerFromPublicKey(owner: PublicKey): TransactionSigner {
  const addr = address(owner.toBase58())
  const partial: TransactionPartialSigner = {
    address: addr,
    async signTransactions() {
      return []
    },
  }
  return partial
}
