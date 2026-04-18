export function RevenuePanel() {
  return (
    <details className="account-revenue-details panel">
      <summary className="account-revenue-summary" id="revenue-deferred-heading">
        Revenue &amp; curator rewards (how it will work)
      </summary>
      <div className="account-revenue-body">
        <p className="muted">
          The per-scene <strong>StakeToCurate</strong> MVP includes stake, rank, unstake, and
          authority rank reset. <code>deposit_revenue</code> and curator distribution across
          scenes are planned for a follow-up milestone — see the product spec for the 20/10/70
          split model.
        </p>
      </div>
    </details>
  )
}
