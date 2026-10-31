import type { CSSProperties } from 'react'

// Fixed positions and timing keep SSR deterministic. Snow is decorative and
// uses no password randomness, timers, canvas or external assets.
const FLAKES = Array.from({ length: 24 }, (_, index) => ({
  x: `${2 + index * 4.1}%`,
  size: `${0.55 + (index % 4) * 0.15}rem`,
  duration: `${15 + (index % 6) * 2}s`,
  delay: `${-index * 1.9}s`,
  drift: `${index % 2 === 0 ? 1.5 : -1.5}rem`,
}))

export default function ChristmasSnow() {
  return (
    <div className="pw-snow" aria-hidden="true">
      {FLAKES.map((flake, index) => (
        <span
          className="pw-snow__flake"
          key={index}
          style={{
            '--snow-x': flake.x,
            '--snow-size': flake.size,
            '--snow-duration': flake.duration,
            '--snow-delay': flake.delay,
            '--snow-drift': flake.drift,
          } as CSSProperties}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" focusable="false">
            <path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4.1-1.1L7 4.8M17 19.2l-1.1-4.1L20 14M4 14l4.1 1.1L7 19.2M17 4.8l-1.1 4.1L20 10" />
          </svg>
        </span>
      ))}
    </div>
  )
}
