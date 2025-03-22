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
  channel_id: string;
  message_id?: string;
  status: string;
  balance_method: string;
  created_at: number;
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
