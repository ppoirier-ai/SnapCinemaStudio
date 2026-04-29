import { MortalPumpFunCta } from './MortalPumpFunCta'

export function SupportStudioDonation() {
  return (
    <div className="support-studio-donation">
      <h2 id="support-heading" className="support-studio-donation-title">
        Support SnapCinema Studio
      </h2>
      <p className="support-studio-donation-eyebrow">Fund the build</p>
      <MortalPumpFunCta variant="support" />
    </div>
  )
}
