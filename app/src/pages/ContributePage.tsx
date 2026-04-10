import { useNavigate } from 'react-router-dom'
import { FanSceneBoard } from '../demo/FanSceneBoard'

export function ContributePage() {
  const navigate = useNavigate()

  return (
    <main className="studio contribute-scenes-page">
      <button
        type="button"
        className="btn btn-ghost contribute-back"
        onClick={() => navigate('/watch')}
      >
        ← Back to Watch
      </button>
      <FanSceneBoard subheading="Same scene matrix as the wallet menu Scene entry. Everything saves in this browser only." />
    </main>
  )
}
