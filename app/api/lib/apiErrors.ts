/** Generic client-facing message for 500 responses (details stay in logs). */
export const GENERIC_INTERNAL_ERROR = 'Something went wrong. Please try again later.'

export function logServerError(scope: string, err: unknown): void {
  console.error(scope, err)
}
