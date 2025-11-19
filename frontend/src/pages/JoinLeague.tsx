import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LEAGUE_TYPES, type LeagueType } from '@/lib/constants'
import './JoinLeague.css'

interface League {
  id: string
  name: string
  type: LeagueType
  code: string
}

export default function JoinLeague() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [league, setLeague] = useState<League | null>(null)
  const [isAlreadyMember, setIsAlreadyMember] = useState(false)

  useEffect(() => {
    if (code) {
      loadLeague()
    } else {
      setError('No league code provided')
      setLoading(false)
    }
  }, [code])

  const loadLeague = async () => {
    if (!code) return

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
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single()

      if (leagueError || !leagueData) {
        setError('League code not found')
        setLoading(false)
        return
      }

      setLeague(leagueData as League)

      // Check if user is already in the league
      const { data: existing } = await supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', leagueData.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setIsAlreadyMember(true)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load league')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!league || !code) return

    setJoining(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to join a league')
        setJoining(false)
        return
      }

      // Check if user is already in the league (double-check)
      const { data: existing } = await supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setError('You are already in this league')
        setIsAlreadyMember(true)
        setJoining(false)
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
      
      // Redirect to league detail page after 2 seconds
      setTimeout(() => {
        navigate(`/league/${league.id}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to join league')
    } finally {
      setJoining(false)
    }
  }

  const handleCancel = () => {
    navigate('/')
  }

  if (loading) {
    return (
      <div className="join-league-container">
        <div className="join-league-card">
          <h1 className="join-league-title">Loading League...</h1>
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    )
  }

  if (error && !league) {
    return (
      <div className="join-league-container">
        <div className="join-league-card">
          <h1 className="join-league-title">Error</h1>
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="back-button">
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="join-league-container">
        <div className="join-league-card">
          <h1 className="join-league-title">Success!</h1>
          <div className="success-message">
            You have successfully joined "{league?.name}"!
          </div>
          <p className="redirect-message">Redirecting to league page...</p>
        </div>
      </div>
    )
  }

  if (!league) {
    return null
  }

  return (
    <div className="join-league-container">
      <div className="join-league-card">
        <h1 className="join-league-title">Join League</h1>
        
        <div className="league-preview">
          <h2 className="league-name">{league.name}</h2>
          <div className="league-details">
            <div className="league-detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">
                {league.type === LEAGUE_TYPES.SALARY_CAP ? 'Salary Cap' : 'Draft'}
              </span>
            </div>
            <div className="league-detail-item">
              <span className="detail-label">Code:</span>
              <span className="detail-value">{league.code}</span>
            </div>
          </div>
        </div>

        {isAlreadyMember ? (
          <>
            <div className="info-message">
              You are already a member of this league.
            </div>
            <button onClick={() => navigate(`/league/${league.id}`)} className="join-button">
              Go to League
            </button>
            <button onClick={handleCancel} className="cancel-button">
              Go to Home
            </button>
          </>
        ) : (
          <>
            {error && <div className="error-message">{error}</div>}
            <div className="button-group">
              <button 
                onClick={handleJoin} 
                disabled={joining}
                className="join-button"
              >
                {joining ? 'Joining...' : 'Join League'}
              </button>
              <button 
                onClick={handleCancel} 
                disabled={joining}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

