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
      <FanSceneBoard subheading="This is the same scene board as Studio → Scenes. Everything saves in your browser only." />
    </main>
  )
}
