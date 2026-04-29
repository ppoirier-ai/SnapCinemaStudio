import { useId } from 'react'
import { getMortalPumpFunUrl } from '../config/mortalPumpFun'

type Props = {
  /** `landing`: Mortal Blockchains section; `support`: Support SnapCinema Studio card */
  variant: 'landing' | 'support'
}

export function MortalPumpFunCta({ variant }: Props) {
  const url = getMortalPumpFunUrl()
  const hintId = useId()
  const rootClass =
    variant === 'support'
      ? 'mortal-pump-cta mortal-pump-cta--support'
      : 'mortal-pump-cta mortal-pump-cta--landing'

  const btnClass =
    variant === 'landing'
      ? 'mortal-pump-cta-btn mortal-pump-cta-btn--mb-landing'
      : 'btn btn-primary mortal-pump-cta-btn'

  return (
    <div className={rootClass}>
      <p className="mortal-pump-cta-text">
        If you want to contribute to the success of <strong>Mortal Blockchains</strong>, feel
        free to purchase the <strong>MORTAL</strong> meme coin on pump.fun.
      </p>
      {!url ? (
        <p id={hintId} className="mortal-pump-cta-hint">
          Trading link coming soon—the button below will open the page once it&apos;s live.
        </p>
      ) : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          Buy MORTAL on pump.fun
        </a>
      ) : (
        <button
          type="button"
          className={btnClass}
          disabled
          aria-describedby={hintId}
        >
          Buy MORTAL on pump.fun
        </button>
      )}
    </div>
  )
}
