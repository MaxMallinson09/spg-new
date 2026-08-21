import { createFileRoute } from '@tanstack/react-router'
import PasswordGenerator from '../components/PasswordGenerator'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="pw-page">
      <PasswordGenerator />
    </div>
  )
}
