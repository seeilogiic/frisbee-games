/**
 * Generates a unique league code using uppercase alphanumeric characters
 * @param length - Length of the code (default: 6)
 * @returns A random code string
 */
export function generateLeagueCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Copies text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
    } catch (fallbackErr) {
      console.error('Failed to copy text:', fallbackErr)
    }
    document.body.removeChild(textArea)
  }
}

/**
 * Gets the base URL for the application, including the base path if deployed to a subdirectory
 * @returns Base URL (e.g., "https://example.com" or "https://example.com/repo-name")
 */
export function getBaseUrl(): string {
  // Use import.meta.env.BASE_URL which Vite provides (includes trailing slash)
  const basePath = import.meta.env.BASE_URL || '/'
  // Remove trailing slash and combine with origin
  const basePathClean = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  return window.location.origin + basePathClean
}

/**
 * Gets the production site URL for email redirects
 * ALWAYS returns the production URL, never localhost
 * Requires VITE_SITE_URL to be set in environment variables
 * @returns Production site URL (never localhost)
 * @throws Error if VITE_SITE_URL is not set
 */
export function getSiteUrl(): string {
  // VITE_SITE_URL must be set - this ensures emails always use production URL
  const siteUrl = import.meta.env.VITE_SITE_URL
  
  if (!siteUrl) {
    const errorMessage = 
      'VITE_SITE_URL environment variable is required for email redirects.\n' +
      'Please set VITE_SITE_URL in your .env.frontend file to your production GitHub Pages URL.\n' +
      'Example: VITE_SITE_URL=https://yourusername.github.io/frisbee-games'
    console.error(errorMessage)
    throw new Error(errorMessage)
  }
  
  return siteUrl
}

/**
 * Calculates fantasy score for a player based on their stats
 * Formula: 3 * assists + 3 * goals + 9 * ds - 3 * turnovers
 * Where turnovers = drops + throwaways
 * @param goals - Number of goals
 * @param assists - Number of assists
 * @param ds - Number of defensive stops
 * @param drops - Number of drops
 * @param throwaways - Number of throwaways
 * @returns Fantasy score
 */
export function calculateFantasyScore(
  goals: number,
  assists: number,
  ds: number,
  drops: number,
  throwaways: number
): number {
  const turnovers = drops + throwaways
  return 3 * assists + 3 * goals + 9 * ds - 3 * turnovers
}

