import { useNavigate } from 'react-router-dom'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { CreatorProjectForm } from '../demo/CreatorProjectForm'
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
      <CollapsibleSection title="Movies" defaultOpen>
        <CreatorProjectForm />
      </CollapsibleSection>
      <CollapsibleSection title="Scene management" defaultOpen>
        <FanSceneBoard />
      </CollapsibleSection>
    </main>
  )
}
