import type { DemoRole } from './types'

type Props = {
  role: DemoRole
  onChange: (r: DemoRole) => void
}

const LABELS: Record<DemoRole, string> = {
  admin: 'Admin',
  creator: 'Creator',
  fan: 'Fan',
}

export function RoleTabs({ role, onChange }: Props) {
  const ids: DemoRole[] = ['admin', 'creator', 'fan']
  return (
    <div className="role-tabs" role="tablist" aria-label="Demo role">
      {ids.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={role === r}
          className={`role-tab${role === r ? ' role-tab-active' : ''}`}
          onClick={() => onChange(r)}
        >
          {LABELS[r]}
        </button>
      ))}
    </div>
  )
}
