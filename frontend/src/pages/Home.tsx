import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AVAILABLE_TEAMS, LEAGUE_TYPES, type LeagueType, type TeamName } from '@/lib/constants'
import { generateLeagueCode, copyToClipboard } from '@/lib/utils'
import './Home.css'

interface League {
  id: string
  name: string
  type: LeagueType
  teams: string[]
  code: string
  created_by: string
  created_at: string
}

export default function Home() {
  const navigate = useNavigate()
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  
  // Create league form state
  const [leagueName, setLeagueName] = useState('')
  const [leagueType, setLeagueType] = useState<LeagueType>(LEAGUE_TYPES.SALARY_CAP)
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  
  // Join league form state
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  
  // Created league state (for showing share link)
  const [createdLeague, setCreatedLeague] = useState<League | null>(null)
  
  // User leagues state
  const [userLeagues, setUserLeagues] = useState<League[]>([])
  const [loadingLeagues, setLoadingLeagues] = useState(true)

  useEffect(() => {
    loadUserLeagues()
  }, [])

  const loadUserLeagues = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('league_participants')
        .select(`
          league_id,
          leagues (
            id,
            name,
            type,
            teams,
            code,
            created_by,
            created_at
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      if (data) {
        const leagues = data.map((item: any) => item.leagues).filter(Boolean) as League[]
        setUserLeagues(leagues)
      }
    } catch (err) {
      console.error('Error loading leagues:', err)
    } finally {
      setLoadingLeagues(false)
    }
  }

  const handleTeamToggle = (team: string) => {
    setSelectedTeams(prev =>
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : [...prev, team]
    )
  }

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)

    if (!leagueName.trim()) {
      setCreateError('League name is required')
      setCreateLoading(false)
      return
    }

    if (selectedTeams.length === 0) {
      setCreateError('Please select at least one team')
      setCreateLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCreateError('You must be logged in to create a league')
        setCreateLoading(false)
        return
      }

      // Generate a unique code (check if it exists, regenerate if needed)
      let code = generateLeagueCode(6)
      let codeExists = true
      let attempts = 0
      
      while (codeExists && attempts < 10) {
        const { data: existing } = await supabase
          .from('leagues')
          .select('id')
          .eq('code', code)
          .single()
        
        if (!existing) {
          codeExists = false
        } else {
          code = generateLeagueCode(6)
          attempts++
        }
      }

      if (codeExists) {
        setCreateError('Failed to generate unique code. Please try again.')
        setCreateLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('leagues')
        .insert({
          name: leagueName.trim(),
          type: leagueType,
          teams: selectedTeams,
          code,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // Add creator as participant
      await supabase
        .from('league_participants')
        .insert({
          league_id: data.id,
          user_id: user.id,
        })

      setCreatedLeague(data)
      setLeagueName('')
      setSelectedTeams([])
      setLeagueType(LEAGUE_TYPES.SALARY_CAP)
      setShowCreateModal(false)
      await loadUserLeagues()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create league')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    setJoinSuccess(null)
    setJoinLoading(true)

    if (!joinCode.trim()) {
      setJoinError('Please enter a league code')
      setJoinLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setJoinError('You must be logged in to join a league')
        setJoinLoading(false)
        return
      }

      // Find league by code
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('code', joinCode.trim().toUpperCase())
        .single()

      if (leagueError || !league) {
        setJoinError('League code not found')
        setJoinLoading(false)
        return
      }

      // Check if user is already in the league
      const { data: existing } = await supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setJoinError('You are already in this league')
        setJoinLoading(false)
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

      setJoinSuccess(`Successfully joined "${league.name}"!`)
      setJoinCode('')
      setShowJoinModal(false)
      await loadUserLeagues()
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setJoinSuccess(null)
      }, 3000)
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join league')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!createdLeague) return
    
    const shareLink = `${window.location.origin}/#/join?code=${createdLeague.code}`
    await copyToClipboard(shareLink)
    alert('Share link copied to clipboard!')
  }

  const handleCopyCode = async () => {
    if (!createdLeague) return
    await copyToClipboard(createdLeague.code)
    alert('League code copied to clipboard!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setCreateError(null)
    setLeagueName('')
    setSelectedTeams([])
    setLeagueType(LEAGUE_TYPES.SALARY_CAP)
  }

  const closeJoinModal = () => {
    setShowJoinModal(false)
    setJoinError(null)
    setJoinSuccess(null)
    setJoinCode('')
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="home-title">Frisbee Fantasy</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </header>
      <main className="home-content">
        {/* Description Section */}
        <section className="description-section">
          <h2 className="section-title">Welcome to Frisbee Fantasy</h2>
          <p className="description-text">
            Create and join fantasy leagues using real college frisbee statistics. 
            Compete with friends by drafting players or building teams within a salary cap 
            using stats from college tournaments.
          </p>
        </section>

        {/* Action Buttons */}
        <section className="action-buttons-section">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="action-button create-button"
          >
            Create League
          </button>
          <button 
            onClick={() => setShowJoinModal(true)} 
            className="action-button join-button"
          >
            Join League
          </button>
        </section>

        {/* Created League Share Section */}
        {createdLeague && (
          <section className="share-section">
            <h3 className="share-title">League Created Successfully!</h3>
            <div className="share-content">
              <div className="share-item">
                <label className="share-label">League Code:</label>
                <div className="share-code-container">
                  <span className="share-code">{createdLeague.code}</span>
                  <button onClick={handleCopyCode} className="copy-button">
                    Copy Code
                  </button>
                </div>
              </div>
              <div className="share-item">
                <label className="share-label">Share Link:</label>
                <div className="share-link-container">
                  <span className="share-link">
                    {window.location.origin}/#/join?code={createdLeague.code}
                  </span>
                  <button onClick={handleCopyShareLink} className="copy-button">
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setCreatedLeague(null)} 
              className="close-share-button"
            >
              Close
            </button>
          </section>
        )}

        {/* User Leagues Section */}
        <section className="user-leagues-section">
          <h2 className="section-title">My Leagues</h2>
          {loadingLeagues ? (
            <div className="loading-text">Loading leagues...</div>
          ) : userLeagues.length === 0 ? (
            <div className="no-leagues-text">You haven't joined any leagues yet.</div>
          ) : (
            <div className="leagues-list">
              {userLeagues.map(league => (
                <div 
                  key={league.id} 
                  className="league-card"
                  onClick={() => navigate(`/league/${league.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <h3 className="league-card-name">{league.name}</h3>
                  <div className="league-card-details">
                    <span className="league-card-type">
                      {league.type === LEAGUE_TYPES.SALARY_CAP ? 'Salary Cap' : 'Draft'}
                    </span>
                    <span className="league-card-code">Code: {league.code}</span>
                  </div>
                  <div className="league-card-teams">
                    Teams: {league.teams.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={closeCreateModal}>×</button>
            <h2 className="modal-title">Create a League</h2>
            <form onSubmit={handleCreateLeague} className="league-form">
              <div className="form-group">
                <label htmlFor="league-name">League Name</label>
                <input
                  id="league-name"
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="Enter league name"
                  required
                  disabled={createLoading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>League Type</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value={LEAGUE_TYPES.SALARY_CAP}
                      checked={leagueType === LEAGUE_TYPES.SALARY_CAP}
                      onChange={(e) => setLeagueType(e.target.value as LeagueType)}
                      disabled={createLoading}
                    />
                    <span>Salary Cap</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value={LEAGUE_TYPES.DRAFT}
                      checked={leagueType === LEAGUE_TYPES.DRAFT}
                      onChange={(e) => setLeagueType(e.target.value as LeagueType)}
                      disabled={createLoading}
                    />
                    <span>Draft</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Select Teams That Will Be Attending Tournament</label>
                <div className="teams-checkbox-group">
                  {AVAILABLE_TEAMS.map((team: TeamName) => (
                    <label key={team} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(team)}
                        onChange={() => handleTeamToggle(team)}
                        disabled={createLoading}
                      />
                      <span>{team}</span>
                    </label>
                  ))}
                </div>
              </div>

              {createError && <div className="error-message">{createError}</div>}
              
              <button 
                type="submit" 
                disabled={createLoading} 
                className="submit-button"
              >
                {createLoading ? 'Creating...' : 'Create League'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={closeJoinModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={closeJoinModal}>×</button>
            <h2 className="modal-title">Join a League</h2>
            <form onSubmit={handleJoinLeague} className="join-form">
              <div className="form-group">
                <label htmlFor="join-code">League Code</label>
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter league code"
                  required
                  disabled={joinLoading}
                  className="form-input"
                  maxLength={10}
                />
              </div>

              {joinError && <div className="error-message">{joinError}</div>}
              {joinSuccess && <div className="success-message">{joinSuccess}</div>}
              
              <button 
                type="submit" 
                disabled={joinLoading} 
                className="submit-button"
              >
                {joinLoading ? 'Joining...' : 'Join League'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
