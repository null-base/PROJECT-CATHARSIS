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
