import { config } from "dotenv";
config();

// 開発環境かどうかを判定
export const IS_DEVELOPMENT =
  process.env.NODE_ENV === "development" ||
  process.env.DISCORD_TOKEN_DEV !== undefined;

export const DISCORD_TOKEN = IS_DEVELOPMENT
  ? process.env.DISCORD_TOKEN_DEV || process.env.DISCORD_TOKEN!
  : process.env.DISCORD_TOKEN!;
export const RIOT_API_KEY = process.env.RIOT_API_KEY!;
export const DEV_GUILD_IDS = process.env.DEV_GUILD_IDS
  ? process.env.DEV_GUILD_IDS.split(",").filter((id) => id.trim() !== "")
  : [];
export const MAINTENANCE_MODE =
  process.env.MAINTENANCE_MODE === "true" || false;

// BOT情報
export const BOT_VERSION = process.env.BOT_VERSION || "NULL";
export const BOT_DEVELOPER_ID =
  process.env.BOT_DEVELOPER_ID || "885153350931333151";
export const BOT_DEVELOPER_NAME = process.env.BOT_DEVELOPER_NAME || "ぬる";
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
