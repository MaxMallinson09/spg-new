import { createFileRoute } from '@tanstack/react-router'
import PasswordGenerator from '../components/PasswordGenerator'
import { APP_VERSION } from '../version'
import '../version.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="pw-page">
      <PasswordGenerator />
      <span className="pw-version" aria-label={`Simple Password Generator ${APP_VERSION}`}>
        {APP_VERSION}
      </span>
    </div>
  )
}
