import { Database } from "bun:sqlite";
import type { CustomGameData, ParticipantData } from "../types/types";

const db = new Database("lol_custom_games.sqlite");

// テーブル作成
db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'LOBBY',
    created_at INTEGER,
    channel_id TEXT,
    message_id TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT,
    user_id TEXT,
    puuid TEXT,
    riot_id TEXT,
    tagline TEXT,
    lane TEXT DEFAULT 'FILL',
    team TEXT DEFAULT '',
    strength REAL DEFAULT 0,
    FOREIGN KEY(game_id) REFERENCES games(id),
    UNIQUE(game_id, user_id)
  )
`);

// ゲーム取得
export const getGame = (gameId: string): CustomGameData | null => {
  return db
    .prepare("SELECT * FROM games WHERE id = ?")
    .get(gameId) as CustomGameData | null;
};

// ゲーム作成
export const createGame = (gameId: string, channelId: string): void => {
  db.prepare(
    "INSERT INTO games (id, created_at, channel_id) VALUES (?, ?, ?)"
  ).run(gameId, Date.now(), channelId);
};

// メッセージID更新
export const updateGameMessage = (gameId: string, messageId: string): void => {
  db.prepare("UPDATE games SET message_id = ? WHERE id = ?").run(
    messageId,
    gameId
  );
};

// ゲームステータス更新
export const updateGameStatus = (gameId: string, status: string): void => {
  db.prepare("UPDATE games SET status = ? WHERE id = ?").run(status, gameId);
};

// 参加者追加
export const addParticipant = (
  gameId: string,
  userId: string,
  puuid: string,
  riotId: string,
  tagline: string,
  strength: number
): void => {
  db.prepare(
    `INSERT INTO participants (
      game_id, user_id, puuid, riot_id, tagline, strength
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(gameId, userId, puuid, riotId, tagline, strength);
};

// 参加者削除
export const removeParticipant = (gameId: string, userId: string): boolean => {
  const result = db
    .prepare("DELETE FROM participants WHERE game_id = ? AND user_id = ?")
    .run(gameId, userId);
  return result.changes > 0;
};

// レーン更新
export const updateParticipantLane = (
  gameId: string,
  userId: string,
  lane: string
): boolean => {
  const result = db
    .prepare(
      "UPDATE participants SET lane = ? WHERE game_id = ? AND user_id = ?"
    )
    .run(lane, gameId, userId);
  return result.changes > 0;
};

// チーム更新（strength パラメータは不要だが、DB構造との互換性のため残します）
export const updateParticipantTeam = (
  gameId: string,
  userId: string,
  team: string
): void => {
  db.prepare(
    "UPDATE participants SET team = ? WHERE game_id = ? AND user_id = ?"
  ).run(team, gameId, userId);
};

// ゲーム参加者取得
export const getParticipants = (gameId: string): ParticipantData[] => {
  return db
    .prepare("SELECT * FROM participants WHERE game_id = ?")
    .all(gameId) as ParticipantData[];
};

// 参加確認
export const isParticipant = (gameId: string, userId: string): boolean => {
  const result = db
    .prepare("SELECT 1 FROM participants WHERE game_id = ? AND user_id = ?")
    .get(gameId, userId);
  return !!result;
};

export const gameDB = {
  getGame,
  createGame,
  updateGameMessage,
  updateGameStatus,
  addParticipant,
  removeParticipant,
  updateParticipantLane,
  updateParticipantTeam,
  getParticipants,
  isParticipant,
};
