import { Database } from "bun:sqlite";
import type { PlayerData } from "../types/types";

// 統合されたデータベースを使用
const db = new Database("lol_custom_games.sqlite");

// プレイヤーテーブルの作成（統合データベース内）
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id TEXT PRIMARY KEY,
    puuid TEXT UNIQUE,
    riot_id TEXT,
    tagline TEXT,
    region TEXT,
    solo_tier TEXT DEFAULT 'UNRANKED',
    solo_division TEXT DEFAULT '',
    solo_lp INTEGER DEFAULT 0,
    flex_tier TEXT DEFAULT 'UNRANKED',
    flex_division TEXT DEFAULT '',
    flex_lp INTEGER DEFAULT 0,
    level INTEGER,
    profile_icon_id INTEGER DEFAULT 0
  )
`);

export const getPlayer = (userId: string): PlayerData | null => {
  return db
    .prepare("SELECT * FROM players WHERE user_id = ?")
    .get(userId) as PlayerData;
};

export const savePlayer = (player: PlayerData) => {
  db.prepare(
    `INSERT OR REPLACE INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    player.user_id,
    player.puuid,
    player.riot_id,
    player.tagline,
    player.region,
    player.solo_tier,
    player.solo_division,
    player.solo_lp,
    player.flex_tier,
    player.flex_division,
    player.flex_lp,
    player.level,
    player.profile_icon_id
  );
};

export const deletePlayer = (userId: string) => {
  return db.prepare("DELETE FROM players WHERE user_id = ?").run(userId);
};

export const getAllPlayers = (): PlayerData[] => {
  return db.prepare("SELECT * FROM players").all() as PlayerData[];
};

export { gameDB } from "./gameDB";
