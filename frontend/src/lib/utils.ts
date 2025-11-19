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

