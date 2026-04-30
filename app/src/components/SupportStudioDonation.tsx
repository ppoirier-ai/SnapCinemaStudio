import { SnapAlphaPrioritySignup } from './SnapAlphaPrioritySignup'
import type { SnapAlphaPrioritySource } from './SnapAlphaPrioritySignup'

type Props = {
  source?: SnapAlphaPrioritySource
}

export function SupportStudioDonation({ source = 'landing' }: Props) {
  return (
    <div className="support-studio-donation">
      <h2 id="support-heading" className="support-studio-donation-title">
        Alpha priority access ($SNAP)
      </h2>
      <SnapAlphaPrioritySignup source={source} />
    </div>
  )
}
