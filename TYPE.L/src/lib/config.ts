import { config } from "dotenv";
config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
export const RIOT_API_KEY = process.env.RIOT_API_KEY!;
export const GUILD_ID = process.env.GUILD_ID;

// BOT情報
export const BOT_VERSION = process.env.BOT_VERSION || "NULL";
export const BOT_DEVELOPER_ID =
  process.env.BOT_DEVELOPER_ID || "834055392727269387";
export const BOT_DEVELOPER_NAME = process.env.BOT_DEVELOPER_NAME || "null先生";
export const BOT_WEBSITE = process.env.BOT_WEBSITE || "null-base.com";
export const BOT_SUPPORT_SERVER =
  process.env.BOT_SUPPORT_SERVER || "https://discord.gg/wNgbkdXq6M";
export const BOT_GITHUB =
  process.env.BOT_GITHUB || "https://github.com/null-base";

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
