import {
  useCallback,
  useEffect,
  useState,
  type SyntheticEvent,
} from 'react'
import { Navigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { AppHeader } from '../components/AppHeader'

const BANNER_VIDEO = '/banner.mp4'

function LandingWalletCta({ id }: { id?: string }) {
  return (
    <div className="landing-cta" id={id}>
      <WalletModalButton className="btn btn-primary landing-connect">
        Connect wallet to begin
      </WalletModalButton>
      <p className="muted landing-cta-note">
        Phantom on Solana devnet. No email—your wallet is your session.
      </p>
    </div>
  )
}

export function LandingPage() {
  const { connected } = useWallet()
  const [videoReady, setVideoReady] = useState(false)
  const [videoAllowed, setVideoAllowed] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setVideoAllowed(!mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const handleVideoCanPlayThrough = useCallback(
    async (e: SyntheticEvent<HTMLVideoElement>) => {
      if (!videoAllowed) return
      const el = e.currentTarget
      try {
        await el.play()
        setVideoReady(true)
      } catch {
        /* autoplay blocked or playback error — keep poster */
      }
    },
    [videoAllowed],
  )

  if (connected) return <Navigate to="/watch" replace />

  return (
    <div className="landing">
      <AppHeader variant="public" />
      <section
        className={`landing-hero ${videoReady ? 'landing-hero--video-ready' : ''}`}
        aria-labelledby="landing-hero-heading"
      >
        <div className="landing-hero-media" aria-hidden>
          <div className="landing-hero-poster" />
          {videoAllowed ? (
            <video
              className="landing-hero-video"
              src={BANNER_VIDEO}
              poster="/banner.jpg"
              muted
              playsInline
              loop
              preload="auto"
              onCanPlayThrough={handleVideoCanPlayThrough}
              onError={() => {
                /* keep image background */
              }}
            />
          ) : null}
        </div>
        <div className="landing-hero-panel">
          <p className="landing-eyebrow">Decentralized movie studio · devnet demo</p>
          <h1 id="landing-hero-heading" className="landing-title landing-title-hero">
            Watch and Contribute to the next big blockbuster
          </h1>
          <p className="landing-lead landing-lead-hero">
            Join thousands of fans to create the next blockbuster movie, or simply watch
            them to earn.
          </p>
          <LandingWalletCta />
        </div>
      </section>

      <main className="landing-main">
        <section className="landing-section" aria-labelledby="pillars-heading">
          <h2 id="pillars-heading" className="landing-section-title">
            Earn income by watching or contributing
          </h2>
          <div className="landing-grid landing-grid-pillars">
            <article className="landing-card">
              <h3 className="landing-card-title">Paid to Watch &amp; Stake</h3>
              <p className="landing-card-body">
                Lock a small amount of Solana when you thumbs up or down various scenes
                throughout the movie, and you may earn if your taste corroborates the
                crowd.
              </p>
            </article>
            <article className="landing-card">
              <h3 className="landing-card-title">Contribute Scenes</h3>
              <p className="landing-card-body">
                Anyone can contribute scenes—use your favorite AI video generator to
                create high-quality scenes that match the rest of the movie. If your
                scenes get upvoted enough, you&apos;ll earn a portion of the income
                generated from the movie.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="flow-heading">
          <h2 id="flow-heading" className="landing-section-title">
            How it works
          </h2>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-num">1</span>
              <div>
                <strong className="landing-step-title">Connect Phantom</strong>
                <p className="landing-step-body">
                  The app uses Solana devnet. Approve the connection—no account signup.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num">2</span>
              <div>
                <strong className="landing-step-title">Watch &amp; pick a scene</strong>
                <p className="landing-step-body">
                  Open Watch, choose a movie, and focus a scene cell that is registered
                  on-chain so reactions can land.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num">3</span>
              <div>
                <strong className="landing-step-title">Stake up or down</strong>
                <p className="landing-step-body">
                  Reactions call the program: SOL transfers to the vault and scene rank
                  moves. Optional instant-staking session can batch approvals for
                  smoother demos.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num">4</span>
              <div>
                <strong className="landing-step-title">Unstake when you&apos;re done</strong>
                <p className="landing-step-body">
                  Unstake returns principal from the vault to you; the scene keeps any
                  residual rank footprint per program rules.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="landing-section-title">
            FAQ
          </h2>
          <div className="landing-faq">
            <details className="landing-faq-item">
              <summary>Will I really earn money watching?</summary>
              <p>
                Only if you upstake (thumbs up) or downstake (thumbs down) a portion of
                Solana on various scenes that also get upstaked and downstaked by other
                users—the more other fans corroborate your stake direction, the more
                you&apos;ll earn.
              </p>
            </details>
            <details className="landing-faq-item">
              <summary>Where does my SOL go when I stake?</summary>
              <p>
                It will be converted to JitoSOL and locked into a Kamino vault to earn
                yield. Once a week, payouts are processed with all the yield collected,
                and you get a portion of the yield based on how well you curated that
                week. Revenue is also topped up by other sources such as advertisers,
                subscriptions for watching, and more.
              </p>
            </details>
            <details className="landing-faq-item">
              <summary>Which wallet do I need?</summary>
              <p>
                The app ships with the <strong>Phantom</strong> adapter. Use Phantom
                pointed at devnet so chain state matches the deployed program and RPC.
              </p>
            </details>
            <details className="landing-faq-item">
              <summary>What is instant staking?</summary>
              <p>
                For a smoother experience, you confirm your stake at the start of
                watching a movie, and every time you upstake or downstake there
                won&apos;t be any required confirmation for your stake. If you finish the
                movie and still have unallocated capital, it will be returned to your
                wallet automatically.
              </p>
            </details>
          </div>
        </section>

        <section
          className="landing-section landing-section-cta"
          aria-labelledby="cta-heading"
        >
          <h2 id="cta-heading" className="landing-section-title landing-section-title-cta">
            Step into the studio
          </h2>
          <p className="landing-cta-blurb">
            Connect once to reach Watch, Scene, and Account—wallet-native cinema for a
            decentralized age.
          </p>
          <LandingWalletCta id="landing-footer-cta" />
        </section>
      </main>
    </div>
  )
}
