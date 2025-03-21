import { config } from "dotenv";
config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
export const RIOT_API_KEY = process.env.RIOT_API_KEY!;
export const GUILD_ID = process.env.GUILD_ID;

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
