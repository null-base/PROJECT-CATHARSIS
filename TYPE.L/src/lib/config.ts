import { config } from "dotenv";
config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
export const RIOT_API_KEY = process.env.RIOT_API_KEY!;
export const GUILD_ID = process.env.GUILD_ID;

export const TIER_VALUES: Record<string, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 3000,
  CHALLENGER: 3200,
};

export const RANK_VALUES: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

export const routingRegionMap: Record<string, string> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  kr: "asia",
  jp1: "asia",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
};
