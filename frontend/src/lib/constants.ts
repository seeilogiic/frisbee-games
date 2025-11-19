export const AVAILABLE_TEAMS = ['AUBURN', 'ALABAMA', 'MSU'] as const

export type TeamName = typeof AVAILABLE_TEAMS[number]

export const LEAGUE_TYPES = {
  SALARY_CAP: 'salary_cap',
  DRAFT: 'draft',
} as const

export type LeagueType = typeof LEAGUE_TYPES[keyof typeof LEAGUE_TYPES]

