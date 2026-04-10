import type { DemoRole } from './types'

type Props = {
  role: DemoRole
  onChange: (r: DemoRole) => void
  /** If set, only these roles appear (e.g. Studio hides Scenes — use Scene in menu). */
  roles?: DemoRole[]
}

const LABELS: Record<DemoRole, string> = {
  admin: 'Admin',
  creator: 'Creator',
  fan: 'Scenes',
}

const DEFAULT_ROLES: DemoRole[] = ['admin', 'creator', 'fan']

export function RoleTabs({ role, onChange, roles = DEFAULT_ROLES }: Props) {
  const ids = roles
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
