import { supabase } from './supabase'

export type RankRow = { rank: number; displayName: string; days: number; isMe: boolean }

export const validNickname = (name: string) => {
  const trimmed = name.trim()
  return trimmed.length >= 2 && trimmed.length <= 24
}

/** Nickname when this account has joined, otherwise null. */
export async function loadMembership(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('leaderboard_members').select('display_name').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data as { display_name: string } | null)?.display_name ?? null
}

export async function joinLeaderboard(userId: string, displayName: string) {
  if (!supabase) throw new Error('unconfigured')
  const { error } = await supabase.from('leaderboard_members').upsert({ user_id: userId, display_name: displayName.trim() })
  if (error) throw error
}

export async function leaveLeaderboard(userId: string) {
  if (!supabase) throw new Error('unconfigured')
  const { error } = await supabase.from('leaderboard_members').delete().eq('user_id', userId)
  if (error) throw error
}

export async function loadMonthlyRanks(): Promise<RankRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('monthly_leaderboard')
  if (error) throw error
  return ((data ?? []) as { rank: number; display_name: string; days: number; is_me: boolean }[]).map((r) => ({
    rank: Number(r.rank), displayName: r.display_name, days: Number(r.days), isMe: r.is_me,
  }))
}
