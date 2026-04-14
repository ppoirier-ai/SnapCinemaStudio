import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'

export type YieldWallet = {
  publicKey: PublicKey
  signTransaction: (
    tx: Transaction | VersionedTransaction,
  ) => Promise<Transaction | VersionedTransaction>
}

/** Narrow to legacy {@link Transaction} for {@link sendAndConfirm}. */
export function legacySigningWallet(wallet: YieldWallet) {
  return {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: Transaction) => {
      const out = await wallet.signTransaction(tx)
      if (out instanceof VersionedTransaction) {
        throw new Error('Expected a legacy Transaction from the wallet adapter')
      }
      return out
    },
  }
}

/** Automation / worker path — no Phantom; uses a local {@link Keypair}. */
export function keypairYieldWallet(keypair: Keypair): YieldWallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: Transaction | VersionedTransaction) => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair])
        return tx
      }
      tx.partialSign(keypair)
      return tx
    },
  }
}
