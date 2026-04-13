/**
 * Kamino kliquidity / klend SDKs emit {@link Instruction} values from `@solana/kit`.
 * The rest of SnapCinema uses legacy {@link TransactionInstruction} + {@link sendAndConfirm}.
 */
import { AccountRole, isInstructionWithAccounts, type Instruction } from '@solana/instructions'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'

function roleToMeta(role: AccountRole): { isSigner: boolean; isWritable: boolean } {
  switch (role) {
    case AccountRole.READONLY:
      return { isSigner: false, isWritable: false }
    case AccountRole.WRITABLE:
      return { isSigner: false, isWritable: true }
    case AccountRole.READONLY_SIGNER:
      return { isSigner: true, isWritable: false }
    case AccountRole.WRITABLE_SIGNER:
      return { isSigner: true, isWritable: true }
    default:
      return { isSigner: false, isWritable: false }
  }
}

export function kitInstructionToLegacy(ix: Instruction): TransactionInstruction {
  if (!isInstructionWithAccounts(ix)) {
    return new TransactionInstruction({
      keys: [],
      programId: new PublicKey(ix.programAddress),
      data: ix.data ? Buffer.from(ix.data) : Buffer.alloc(0),
    })
  }
  const keys = ix.accounts.map((meta) => {
    if ('lookupTableAddress' in meta) {
      throw new Error(
        'Instruction uses an address lookup table; build a versioned transaction instead.',
      )
    }
    const { isSigner, isWritable } = roleToMeta(meta.role)
    return {
      pubkey: new PublicKey(meta.address),
      isSigner,
      isWritable,
    }
  })
  return new TransactionInstruction({
    keys,
    programId: new PublicKey(ix.programAddress),
    data: ix.data ? Buffer.from(ix.data) : Buffer.alloc(0),
  })
}

export function kitInstructionsToLegacy(ixs: readonly Instruction[]): TransactionInstruction[] {
  return ixs.map(kitInstructionToLegacy)
}
