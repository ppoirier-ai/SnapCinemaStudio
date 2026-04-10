import { useNavigate } from 'react-router-dom'
import { useDemoSlot } from '../context/DemoSlotContext'
import { FanContributePanel } from '../demo/FanContributePanel'

export function ContributePage() {
  const navigate = useNavigate()
  const { append } = useDemoSlot()

  return (
    <main className="studio">
      <FanContributePanel
        onBack={() => navigate('/watch')}
        onSubmitted={(summary) => {
          append(summary)
        }}
      />
    </main>
  )
}
