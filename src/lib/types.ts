export type SkillLevel = 'beginner' | 'advanced_beginner' | 'novice' | 'intermediate' | 'advanced'

export const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced_beginner', label: 'Advanced Beginner' },
  { value: 'novice', label: 'Novice' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export type SessionMode = 'guest' | 'hosted'
export type SessionStatus = 'active' | 'ended'
export type CourtStatus = 'available' | 'occupied'
export type QueueStatus = 'waiting' | 'playing' | 'done'
export type GameMode = 'singles' | 'doubles'

export interface Session {
  id: string
  mode: SessionMode
  game_mode: GameMode
  creator_account_id: string | null
  start_time: string
  end_time: string | null
  status: SessionStatus
}

export interface Court {
  id: string
  session_id: string
  name: string
  assigned_skill_level: SkillLevel
  status: CourtStatus
}

export interface Player {
  id: string
  session_id: string
  name: string
  skill_level: SkillLevel
  account_id: string | null
  is_guest: boolean
}

export interface QueueEntry {
  id: string
  session_id: string
  player_id: string
  skill_level: SkillLevel
  joined_at: string
  status: QueueStatus
  player?: Player
}

export interface Match {
  id: string
  session_id: string
  court_id: string
  game_mode: GameMode
  team1_player_ids: string[]
  team2_player_ids: string[]
  team1_score: number
  team2_score: number
  played_at: string
}

export interface PlayerSessionScore {
  player_id: string
  session_id: string
  total_score: number
  games_played: number
  player?: Player
}

export interface PairScore {
  player1_id: string
  player2_id: string
  session_id: string
  total_score: number
  games_played: number
  player1?: Player
  player2?: Player
}
