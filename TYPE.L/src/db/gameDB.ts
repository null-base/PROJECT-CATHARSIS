import { Database } from "bun:sqlite";
import type { ChampionStats, CustomGameData, GameHistory, ParticipantData } from "../types/types";

const db = new Database("lol_custom_games.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    blue_team_win BOOLEAN NOT NULL,
    played_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    game_duration INTEGER,
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    UNIQUE(match_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    champion_id INTEGER,
    champion_name TEXT,
    team TEXT NOT NULL,
    position TEXT,
    win BOOLEAN NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    FOREIGN KEY(game_id) REFERENCES games(game_id),
    UNIQUE(match_id, user_id)
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

// ゲーム結果を保存
export const saveGameResult = (
  gameId: string,
  serverId: string,
  matchId: string,
  blueTeamWin: boolean,
  gameDuration: number
): void => {
  db.prepare(
    `INSERT OR REPLACE INTO game_results (
      game_id, server_id, match_id, blue_team_win, game_duration
    ) VALUES (?, ?, ?, ?, ?)`
  ).run(gameId, serverId, matchId, blueTeamWin ? 1 : 0, gameDuration);
};

// プレイヤーのゲーム結果を保存
export const savePlayerGameResult = (
  gameId: string,
  serverId: string,
  userId: string,
  matchId: string,
  championId: number,
  championName: string,
  team: string,
  position: string,
  win: boolean,
  kills: number,
  deaths: number,
  assists: number
): void => {
  db.prepare(
    `INSERT OR REPLACE INTO player_game_results (
      game_id, server_id, user_id, match_id, champion_id, champion_name,
      team, position, win, kills, deaths, assists
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    gameId,
    serverId,
    userId,
    matchId,
    championId,
    championName,
    team,
    position,
    win ? 1 : 0,
    kills,
    deaths,
    assists
  );
};

// サーバーのゲーム統計を取得
export const getServerGameStats = (serverId: string) => {
  return {
    totalGames: (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM game_results WHERE server_id = ?"
        )
        .get(serverId) as { count: number }
    ).count,
    blueWins: (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM game_results WHERE server_id = ? AND blue_team_win = 1"
        )
        .get(serverId) as { count: number }
    ).count,
    redWins: (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM game_results WHERE server_id = ? AND blue_team_win = 0"
        )
        .get(serverId) as { count: number }
    ).count,
  };
};

// プレイヤーの戦績を取得
export const getPlayerStats = (serverId: string, userId: string) => {
  return {
    games: (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM player_game_results WHERE server_id = ? AND user_id = ?"
        )
        .get(serverId, userId) as { count: number }
    ).count,
    wins: (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM player_game_results WHERE server_id = ? AND user_id = ? AND win = 1"
        )
        .get(serverId, userId) as { count: number }
    ).count,
    kills:
      (
        db
          .prepare(
            "SELECT SUM(kills) as sum FROM player_game_results WHERE server_id = ? AND user_id = ?"
          )
          .get(serverId, userId) as { sum: number | null }
      ).sum || 0,
    deaths:
      (
        db
          .prepare(
            "SELECT SUM(deaths) as sum FROM player_game_results WHERE server_id = ? AND user_id = ?"
          )
          .get(serverId, userId) as { sum: number | null }
      ).sum || 0,
    assists:
      (
        db
          .prepare(
            "SELECT SUM(assists) as sum FROM player_game_results WHERE server_id = ? AND user_id = ?"
          )
          .get(serverId, userId) as { sum: number | null }
      ).sum || 0,
  };
};

// トップチャンピオン取得
export const getPlayerTopChampions = (
  serverId: string,
  userId: string,
  limit: number = 5
): ChampionStats[] => {
  return db
    .prepare(
      `SELECT
        champion_name,
        COUNT(*) as games,
        SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) as wins,
        SUM(kills) as kills,
        SUM(deaths) as deaths,
        SUM(assists) as assists
      FROM player_game_results
      WHERE server_id = ? AND user_id = ?
      GROUP BY champion_id
      ORDER BY games DESC
      LIMIT ?`
    )
    .all(serverId, userId, limit) as ChampionStats[];
};

// サーバーのゲーム履歴を取得
export const getServerGameHistory = (
  serverId: string,
  limit: number = 10
): GameHistory[] => {
  return db
    .prepare(
      `SELECT * FROM game_results
      WHERE server_id = ?
      ORDER BY played_at DESC
      LIMIT ?`
    )
    .all(serverId, limit) as GameHistory[];
};

// gameDBオブジェクトに新しい関数を追加
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
  saveGameResult,
  savePlayerGameResult,
  getServerGameStats,
  getPlayerStats,
  getPlayerTopChampions,
  getServerGameHistory,
};
