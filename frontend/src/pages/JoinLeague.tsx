import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import './JoinLeague.css'

export default function JoinLeague() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [leagueName, setLeagueName] = useState<string | null>(null)

  useEffect(() => {
    if (code) {
      handleJoin(code)
    } else {
      setError('No league code provided')
    }
  }, [code])

  const handleJoin = async (leagueCode: string) => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to join a league')
        setLoading(false)
        return
      }

      // Find league by code
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('code', leagueCode.trim().toUpperCase())
        .single()

      if (leagueError || !league) {
        setError('League code not found')
        setLoading(false)
        return
      }

      setLeagueName(league.name)

      // Check if user is already in the league
      const { data: existing } = await supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setError('You are already in this league')
        setLoading(false)
        return
      }

      // Join the league
      const { error: joinError } = await supabase
        .from('league_participants')
        .insert({
          league_id: league.id,
          user_id: user.id,
        })

      if (joinError) throw joinError

      setSuccess(true)
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to join league')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="join-league-container">
      <div className="join-league-card">
        {loading && (
          <>
            <h1 className="join-league-title">Joining League...</h1>
            <div className="loading-spinner">Loading...</div>
          </>
        )}
        
        {error && !loading && (
          <>
            <h1 className="join-league-title">Join Failed</h1>
            <div className="error-message">{error}</div>
            <button onClick={() => navigate('/')} className="back-button">
              Go to Home
            </button>
          </>
        )}
        
        {success && !loading && (
          <>
            <h1 className="join-league-title">Success!</h1>
            <div className="success-message">
              You have successfully joined "{leagueName}"!
            </div>
            <p className="redirect-message">Redirecting to home page...</p>
          </>
        )}
      </div>
    </div>
  )
}

