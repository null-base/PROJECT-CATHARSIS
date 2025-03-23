import { Database } from "bun:sqlite";
import type { CustomGameData, ParticipantData } from "../types/types";

const db = new Database("lol_custom_games.sqlite");

// テーブル作成（既存のテーブルを削除して再作成）
db.exec(`DROP TABLE IF EXISTS participants`);
db.exec(`DROP TABLE IF EXISTS games`);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    status TEXT DEFAULT 'WAITING',
    balance_method TEXT DEFAULT 'random',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    spectator_match_id TEXT,
    spectator_region TEXT,
    last_updated INTEGER
  )
`);

db.exec(`
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
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    UNIQUE(game_id, user_id)
  )
`);

// ゲーム取得
export const getGame = (gameId: string): CustomGameData | undefined => {
  return db
    .prepare(
      "SELECT game_id, server_id, channel_id, message_id, status, balance_method, created_at, spectator_match_id, spectator_region, last_updated FROM games WHERE game_id = ?"
    )
    .get(gameId) as CustomGameData | undefined;
};

// ゲーム作成
export const createGame = (
  gameId: string,
  serverId: string,
  channelId: string,
  balanceMethod = "random"
) => {
  db.prepare(
    "INSERT INTO games (game_id, server_id, channel_id, balance_method) VALUES (?, ?, ?, ?)"
  ).run(gameId, serverId, channelId, balanceMethod);
};

// メッセージID更新
export const updateGameMessage = (gameId: string, messageId: string): void => {
  db.prepare("UPDATE games SET message_id = ? WHERE game_id = ?").run(
    messageId,
    gameId
  );
};

// ゲームステータス更新
export const updateGameStatus = (gameId: string, status: string): void => {
  db.prepare("UPDATE games SET status = ? WHERE game_id = ?").run(
    status,
    gameId
  );
};

// バランス方法を更新する関数
export const updateGameBalanceMethod = (
  gameId: string,
  method: string
): void => {
  db.prepare("UPDATE games SET balance_method = ? WHERE game_id = ?").run(
    method,
    gameId
  );
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

// 試合ID更新関数を追加
export const updateGameSpectatorInfo = (
  gameId: string,
  matchId: string,
  region: string
): void => {
  db.prepare(
    "UPDATE games SET spectator_match_id = ?, spectator_region = ?, last_updated = ? WHERE game_id = ?"
  ).run(matchId, region, Math.floor(Date.now() / 1000), gameId);
};

// アクティブなゲームを取得する関数
export const getActiveGames = (): CustomGameData[] => {
  return db
    .prepare(
      "SELECT * FROM games WHERE status IN ('WAITING', 'TRACKING') ORDER BY created_at DESC"
    )
    .all() as CustomGameData[];
};

// 古いゲームを削除する関数
export const cleanupOldGames = (cutoffTime: number): number => {
  // 削除対象のゲームIDを取得
  const gameIds = db
    .prepare("SELECT game_id FROM games WHERE created_at < ?")
    .all(cutoffTime)
    .map((row: any) => row.game_id);

  // 参加者を削除
  for (const gameId of gameIds) {
    db.prepare("DELETE FROM participants WHERE game_id = ?").run(gameId);
  }

  // ゲームを削除
  const result = db
    .prepare("DELETE FROM games WHERE created_at < ?")
    .run(cutoffTime);
  return result.changes;
};

export const gameDB = {
  getGame,
  createGame,
  updateGameMessage,
  updateGameStatus,
  updateGameBalanceMethod,
  addParticipant,
  removeParticipant,
  updateParticipantLane,
  updateParticipantTeam,
  getParticipants,
  isParticipant,
  updateGameSpectatorInfo,
  getActiveGames,
  cleanupOldGames,
};
