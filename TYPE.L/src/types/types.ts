export type PlayerData = {
  user_id: string;
  puuid: string;
  riot_id: string;
  tagline: string;
  region: string;
  solo_tier: string;
  solo_division: string;
  solo_lp: number;
  flex_tier: string;
  flex_division: string;
  flex_lp: number;
  level: number;
  profile_icon_id: number;
};

export type MatchData = {
  champion: string;
  lane: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
};

export type CommandHandler = {
  data: any;
  execute: (interaction: any) => Promise<void>;
};

// カスタムゲーム関連の型定義
export interface CustomGameData {
  game_id: string;
  server_id: string;
  channel_id: string;
  message_id?: string;
  status: string;
  balance_method: string;
  created_at: number;
  spectator_match_id?: string;
  spectator_region?: string;
  last_updated?: number;
}

export type ParticipantData = {
  id: number;
  game_id: string;
  user_id: string;
  puuid: string;
  riot_id: string;
  tagline: string;
  lane: string;
  team: string;
  strength: number;
};

// チャンピオン統計情報の型定義
export interface ChampionStats {
  champion_name: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

// ゲーム履歴の型定義
export interface GameHistory {
  id?: number;
  game_id: string;
  server_id: string;
  match_id: string;
  blue_team_win: number;
  played_at: number;
  game_duration: number;
}
