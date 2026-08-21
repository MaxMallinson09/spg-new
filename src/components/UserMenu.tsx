import { useEffect, useState } from 'react'

type Profile = {
  name: string | null
  picture: string | null
}

/**
 * Shows who is signed in and offers a way out.
 *
 * The profile comes from /auth/me, which the edge function answers by decoding
 * the session cookie. The cookie itself is HttpOnly, so this component never
 * sees the token -- only the handful of display fields it needs.
 */
export default function UserMenu() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/auth/me', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.authenticated) return
        setProfile({ name: data.name ?? null, picture: data.picture ?? null })
      })
      .catch(() => {
        // A failed lookup just means no chip; the page is already gated.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!profile) return null

  const label = profile.name ?? 'Signed in'

  return (
    <div className="pw-user">
      {profile.picture ? (
        <img className="pw-user__avatar" src={profile.picture} alt="" aria-hidden="true" />
      ) : (
        <span className="pw-user__avatar pw-user__avatar--initial" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="pw-user__name" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="pw-user__logout"
        onClick={() => window.location.assign('/auth/logout')}
      >
        Log out
      </button>
    </div>
  )
}
