export const PRESETS_LAMPORTS = [
  BigInt(10_000_000),
  BigInt(50_000_000),
  BigInt(100_000_000),
]

/** Lamports locked per Watch thumbs up / down / flag (0.01 SOL) — full amount sent to vault. */
export const FAN_REACTION_STAKE_LAMPORTS = BigInt(10_000_000)

/**
 * On-chain rank moves by `stake_lamports / RANK_STAKE_SCALE_DIVISOR` (min 1). Must match
 * `RANK_STAKE_SCALE` in `programs/stake_to_curate`.
 */
export const RANK_STAKE_SCALE_DIVISOR = 10n

/**
 * Rank added or removed per default Watch reaction (stake ÷ scale). Kept as the “smaller”
 * number while **`FAN_REACTION_STAKE_LAMPORTS`** stays 0.01 SOL.
 */
export const FAN_REACTION_LAMPORTS =
  FAN_REACTION_STAKE_LAMPORTS / RANK_STAKE_SCALE_DIVISOR

/** Matches `MIN_INITIAL_RANK` in `programs/stake_to_curate` (rank floor, lamports-scale). */
export const STAKE_MIN_INITIAL_RANK_LAMPORTS = 1_000_000n

/**
 * Initial `Scene.rank` when registering. Must be ≥ floor + rank delta for one max downstake
 * at `FAN_REACTION_STAKE_LAMPORTS` (uses `FAN_REACTION_LAMPORTS` rank step).
 */
export const REGISTER_SCENE_INITIAL_RANK_LAMPORTS =
  STAKE_MIN_INITIAL_RANK_LAMPORTS + FAN_REACTION_LAMPORTS
