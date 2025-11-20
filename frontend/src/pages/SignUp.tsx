import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import './SignUp.css'

interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Redirect to returnTo if provided, otherwise go to home
        navigate(returnTo || '/', { replace: true })
      }
    }
    checkUser()
  }, [navigate, returnTo])

  useEffect(() => {
    // Validate password requirements
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    })
  }, [password])

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!allRequirementsMet) {
      setError('Please meet all password requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // Redirect to login page after successful sign-up
      navigate(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login', { replace: true })
    } catch (err: any) {
      // Show the actual error message instead of generic message
      setError(err?.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1 className="signup-title">Sign Up</h1>
        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="form-input"
            />
            <div className="password-requirements">
              <div className={`requirement ${passwordRequirements.minLength ? 'met' : ''}`}>
                {passwordRequirements.minLength ? '✓' : '○'} At least 8 characters
              </div>
              <div className={`requirement ${passwordRequirements.hasUppercase ? 'met' : ''}`}>
                {passwordRequirements.hasUppercase ? '✓' : '○'} One uppercase letter
              </div>
              <div className={`requirement ${passwordRequirements.hasLowercase ? 'met' : ''}`}>
                {passwordRequirements.hasLowercase ? '✓' : '○'} One lowercase letter
              </div>
              <div className={`requirement ${passwordRequirements.hasNumber ? 'met' : ''}`}>
                {passwordRequirements.hasNumber ? '✓' : '○'} One number
              </div>
              <div className={`requirement ${passwordRequirements.hasSpecialChar ? 'met' : ''}`}>
                {passwordRequirements.hasSpecialChar ? '✓' : '○'} One special character
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className={`form-input ${confirmPassword.length > 0 && !passwordsMatch ? 'error' : ''}`}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <div className="error-text">Passwords do not match</div>
            )}
          </div>
          {error && <div className="error-message">{error}</div>}
          <button 
            type="submit" 
            disabled={loading || !allRequirementsMet || !passwordsMatch} 
            className="submit-button"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <div className="login-link-container">
          Already have an account? <Link to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} className="login-link">Sign in</Link>
        </div>
      </div>
    </div>
  )
}

