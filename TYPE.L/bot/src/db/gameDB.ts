import { Database } from "bun:sqlite";
import type {
  ChampionStats,
  CustomGameData,
  GameHistory,
  ParticipantData,
} from "../types/types";

// データベースファイルのパス（統合済み）
const DB_PATH = "lol_custom_games.sqlite";

// データベース接続
const db = new Database(DB_PATH);

// SQLiteのパフォーマンス設定
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA foreign_keys = ON;");

// データベース初期化（テーブル作成）
function initDatabase() {
  console.log("統合データベース構造を初期化します");

  try {
    // プレイヤーテーブル（統合）
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

    // サーバーテーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT,
        first_seen INTEGER DEFAULT (strftime('%s', 'now')),
        last_active INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // ゲームユーザーテーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_users (
        user_id TEXT PRIMARY KEY,
        riot_id TEXT NOT NULL,
        tagline TEXT NOT NULL,
        puuid TEXT UNIQUE,
        first_seen INTEGER DEFAULT (strftime('%s', 'now')),
        last_active INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // ゲームテーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        status TEXT NOT NULL DEFAULT 'WAITING',
        balance_method TEXT NOT NULL DEFAULT 'random',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        finished_at INTEGER,
        match_id TEXT,
        match_region TEXT,
        FOREIGN KEY(server_id) REFERENCES servers(id)
      )
    `);

    // 参加者テーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        lane TEXT NOT NULL DEFAULT 'FILL',
        team TEXT DEFAULT NULL,
        joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES game_users(user_id),
        UNIQUE(game_id, user_id)
      )
    `);

    // 試合結果テーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS match_results (
        match_id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        match_duration INTEGER NOT NULL,
        blue_team_win INTEGER NOT NULL,
        played_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // プレイヤーパフォーマンステーブル
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_performances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        champion_id INTEGER NOT NULL,
        champion_name TEXT NOT NULL,
        team TEXT NOT NULL,
        position TEXT,
        kills INTEGER NOT NULL DEFAULT 0,
        deaths INTEGER NOT NULL DEFAULT 0,
        assists INTEGER NOT NULL DEFAULT 0,
        gold_earned INTEGER,
        vision_score INTEGER,
        cs INTEGER,
        win INTEGER NOT NULL,
        FOREIGN KEY(match_id) REFERENCES match_results(match_id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES game_users(user_id),
        UNIQUE(match_id, user_id)
      )
    `);

    // インデックス追加
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_games_server_id ON games(server_id);"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);");
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_participants_game_id ON participants(game_id);"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_performances_user_id ON player_performances(user_id);"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_match_results_game_id ON match_results(game_id);"
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_player_performances_champion ON player_performances(champion_id, champion_name);"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_players_puuid ON players(puuid);");
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_players_riot_id ON players(riot_id);"
    );

    console.log("✅ 統合データベース構造の初期化が完了しました");
  } catch (error) {
    console.error("❌ データベース初期化エラー:", error);
    throw error;
  }
}

// データベース初期化を実行
initDatabase();

// === サーバー関連の関数 ===

// サーバー情報を登録/更新
export const registerServer = (serverId: string, serverName: string): void => {
  db.prepare(
    `
    INSERT INTO servers (id, name, last_active)
    VALUES (?, ?, strftime('%s', 'now'))
    ON CONFLICT (id) DO UPDATE SET
      name = ?,
      last_active = strftime('%s', 'now')
  `
  ).run(serverId, serverName, serverName);
};

// === ゲーム関連の関数 ===

// ゲーム作成
export const createGame = (
  gameId: string,
  serverId: string,
  channelId: string,
  balanceMethod = "random"
): void => {
  // サーバーが存在しない場合は追加（名前は後で更新可能）
  db.prepare(
    `
    INSERT OR IGNORE INTO servers (id) VALUES (?)
  `
  ).run(serverId);

  db.prepare(
    `
    INSERT INTO games (
      id, server_id, channel_id, balance_method
    ) VALUES (?, ?, ?, ?)
  `
  ).run(gameId, serverId, channelId, balanceMethod);
};

// ゲーム取得
export const getGame = (gameId: string): CustomGameData | undefined => {
  return db
    .prepare(
      `
      SELECT
        id as game_id,
        server_id,
        channel_id,
        message_id,
        status,
        balance_method,
        created_at,
        match_id as spectator_match_id,
        match_region as spectator_region,
        updated_at as last_updated
      FROM games
      WHERE id = ?
    `
    )
    .get(gameId) as CustomGameData | undefined;
};

// メッセージID更新
export const updateGameMessage = (gameId: string, messageId: string): void => {
  db.prepare(
    `
    UPDATE games SET
      message_id = ?,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `
  ).run(messageId, gameId);
};

// ゲームステータス更新
export const updateGameStatus = (gameId: string, status: string): void => {
  const query =
    status === "COMPLETED"
      ? `UPDATE games SET status = ?, updated_at = strftime('%s', 'now'), finished_at = strftime('%s', 'now') WHERE id = ?`
      : `UPDATE games SET status = ?, updated_at = strftime('%s', 'now') WHERE id = ?`;

  db.prepare(query).run(status, gameId);
};

// バランス方法を更新する関数
export const updateGameBalanceMethod = (
  gameId: string,
  method: string
): void => {
  db.prepare(
    `
    UPDATE games SET
      balance_method = ?,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `
  ).run(method, gameId);
};

// 試合ID更新関数
export const updateGameSpectatorInfo = (
  gameId: string,
  matchId: string,
  region: string
): void => {
  db.prepare(
    `
    UPDATE games SET
      match_id = ?,
      match_region = ?,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `
  ).run(matchId, region, gameId);
};

// アクティブなゲームを取得する関数
export const getActiveGames = (): CustomGameData[] => {
  try {
    return db
      .prepare(
        `
        SELECT
          id as game_id,
          server_id,
          channel_id,
          message_id,
          status,
          balance_method,
          created_at,
          match_id as spectator_match_id,
          match_region as spectator_region,
          updated_at as last_updated
        FROM games
        WHERE status IN ('WAITING', 'TRACKING')
        ORDER BY created_at DESC
      `
      )
      .all() as CustomGameData[];
  } catch (error) {
    console.error("アクティブゲーム取得エラー:", error);
    return [];
  }
};

// 古いゲームを削除する関数
export const cleanupOldGames = (cutoffTime: number): number => {
  return db.prepare("DELETE FROM games WHERE created_at < ?").run(cutoffTime)
    .changes;
};

// === 参加者関連の関数 ===

// プレイヤー登録（ゲームユーザー）
export const registerGameUser = (
  userId: string,
  puuid: string | null,
  riotId: string,
  tagline: string
): void => {
  db.prepare(
    `
    INSERT INTO game_users (
      user_id, puuid, riot_id, tagline, last_active
    ) VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT (user_id) DO UPDATE SET
      puuid = COALESCE(?, puuid),
      riot_id = ?,
      tagline = ?,
      last_active = strftime('%s', 'now')
  `
  ).run(userId, puuid, riotId, tagline, puuid, riotId, tagline);
};

// 参加者追加
export const addParticipant = (
  gameId: string,
  userId: string,
  puuid: string | null,
  riotId: string,
  tagline: string
): void => {
  // まずユーザーを登録
  registerGameUser(userId, puuid, riotId, tagline);

  // 参加者として追加
  db.prepare(
    `
    INSERT INTO participants (
      game_id, user_id
    ) VALUES (?, ?)
    ON CONFLICT (game_id, user_id) DO NOTHING
  `
  ).run(gameId, userId);
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

// チーム更新
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
    .prepare(
      `
      SELECT
        p.user_id,
        u.puuid,
        u.riot_id,
        u.tagline,
        p.lane,
        p.team,
        0 as strength
      FROM participants p
      JOIN game_users u ON p.user_id = u.user_id
      WHERE p.game_id = ?
    `
    )
    .all(gameId) as ParticipantData[];
};

// 参加確認
export const isParticipant = (gameId: string, userId: string): boolean => {
  const result = db
    .prepare("SELECT 1 FROM participants WHERE game_id = ? AND user_id = ?")
    .get(gameId, userId);
  return !!result;
};

// === 試合結果関連の関数 ===

// ゲーム結果を保存
export const saveGameResult = (
  gameId: string,
  matchId: string,
  blueTeamWin: boolean,
  gameDuration: number
): void => {
  db.prepare(
    `
    INSERT OR REPLACE INTO match_results (
      match_id, game_id, match_duration, blue_team_win, played_at
    ) VALUES (?, ?, ?, ?, strftime('%s', 'now'))
  `
  ).run(matchId, gameId, gameDuration, blueTeamWin ? 1 : 0);

  // ゲームを完了状態に
  updateGameStatus(gameId, "COMPLETED");
};

// プレイヤーのゲーム結果を保存
export const savePlayerGameResult = (
  matchId: string,
  userId: string,
  championId: number,
  championName: string,
  team: string,
  position: string | null,
  win: boolean,
  kills: number,
  deaths: number,
  assists: number,
  goldEarned: number | null = null,
  visionScore: number | null = null,
  cs: number | null = null
): void => {
  db.prepare(
    `
    INSERT OR REPLACE INTO player_performances (
      match_id, user_id, champion_id, champion_name, team, position,
      kills, deaths, assists, gold_earned, vision_score, cs, win
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    matchId,
    userId,
    championId,
    championName,
    team,
    position,
    kills,
    deaths,
    assists,
    goldEarned,
    visionScore,
    cs,
    win ? 1 : 0
  );
};

// === 統計関連の関数 ===

// サーバーのゲーム統計を取得
export const getServerGameStats = (serverId: string) => {
  const totalGamesQuery = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM match_results r
      JOIN games g ON r.game_id = g.id
      WHERE g.server_id = ?
    `
    )
    .get(serverId) as { count: number };

  const blueWinsQuery = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM match_results r
      JOIN games g ON r.game_id = g.id
      WHERE g.server_id = ? AND r.blue_team_win = 1
    `
    )
    .get(serverId) as { count: number };

  const redWinsQuery = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM match_results r
      JOIN games g ON r.game_id = g.id
      WHERE g.server_id = ? AND r.blue_team_win = 0
    `
    )
    .get(serverId) as { count: number };

  return {
    totalGames: totalGamesQuery.count,
    blueWins: blueWinsQuery.count,
    redWins: redWinsQuery.count,
  };
};

// プレイヤーの戦績を取得
export const getPlayerStats = (serverId: string, userId: string) => {
  const gamesQuery = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM player_performances pp
      JOIN match_results mr ON pp.match_id = mr.match_id
      JOIN games g ON mr.game_id = g.id
      WHERE g.server_id = ? AND pp.user_id = ?
    `
    )
    .get(serverId, userId) as { count: number };

  const winsQuery = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM player_performances pp
      JOIN match_results mr ON pp.match_id = mr.match_id
      JOIN games g ON mr.game_id = g.id
      WHERE g.server_id = ? AND pp.user_id = ? AND pp.win = 1
    `
    )
    .get(serverId, userId) as { count: number };

  const statsQuery = db
    .prepare(
      `
      SELECT
        SUM(pp.kills) as kills,
        SUM(pp.deaths) as deaths,
        SUM(pp.assists) as assists
      FROM player_performances pp
      JOIN match_results mr ON pp.match_id = mr.match_id
      JOIN games g ON mr.game_id = g.id
      WHERE g.server_id = ? AND pp.user_id = ?
    `
    )
    .get(serverId, userId) as {
    kills: number | null;
    deaths: number | null;
    assists: number | null;
  };

  return {
    games: gamesQuery.count,
    wins: winsQuery.count,
    kills: statsQuery.kills || 0,
    deaths: statsQuery.deaths || 0,
    assists: statsQuery.assists || 0,
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
      `
      SELECT
        champion_name,
        COUNT(*) as games,
        SUM(CASE WHEN win = 1 THEN 1 ELSE 0 END) as wins,
        SUM(kills) as kills,
        SUM(deaths) as deaths,
        SUM(assists) as assists
      FROM player_performances pp
      JOIN match_results mr ON pp.match_id = mr.match_id
      JOIN games g ON mr.game_id = g.id
      WHERE g.server_id = ? AND pp.user_id = ?
      GROUP BY champion_id
      ORDER BY games DESC, wins DESC
      LIMIT ?
    `
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
      `
      SELECT
        mr.match_id,
        g.id as game_id,
        g.server_id,
        mr.blue_team_win,
        mr.played_at,
        mr.match_duration as game_duration
      FROM match_results mr
      JOIN games g ON mr.game_id = g.id
      WHERE g.server_id = ?
      ORDER BY mr.played_at DESC
      LIMIT ?
    `
    )
    .all(serverId, limit) as GameHistory[];
};

// gameDBオブジェクトにエクスポート
export const gameDB = {
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
  registerServer,
  registerGameUser,
  getGame,
};
