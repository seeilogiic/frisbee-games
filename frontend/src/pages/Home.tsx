import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="home-title">Home</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </header>
      <main className="home-content">
        {/* Placeholder for future content */}
      </main>
    </div>
  )
}

