import { ChannelType } from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { createGameTrackingEmbed } from "../embedBuilders/trackingEmbeds";
import { RiotAPI } from "../lib/riotApi";
import type { CustomGameData, ParticipantData } from "../types/types";
import { displayGameResult } from "./resultService";

// ゲームの追跡を開始
export async function startTrackingGame(
  interaction: any,
  gameId: string,
  participants: ParticipantData[]
) {
  // ゲームIDごとの参加者数をトラッキングするMapを作成
  const gameCountMap = new Map<
    string,
    {
      count: number;
      game: any;
      player: any;
      region: string;
    }
  >();

  let notFoundCount = 0; // 404エラーカウント用
  const totalPlayers = participants.length; // 全参加者数

  // 参加者の現在のゲームを検索
  for (const participant of participants) {
    const player = getPlayer(participant.user_id);
    if (!player) continue;

    try {
      const game = await RiotAPI.getActiveGame(player.region, player.puuid);

      if (game) {
        // ゲームIDをキーとして、そのゲームに参加しているプレイヤー数をカウント
        const gameId = game.gameId.toString();
        if (!gameCountMap.has(gameId)) {
          gameCountMap.set(gameId, {
            count: 1,
            game,
            player,
            region: player.region,
          });
        } else {
          const entry = gameCountMap.get(gameId)!;
          entry.count += 1;
        }
      }
    } catch (error: any) {
      // 404エラー（プレイヤーがゲーム中でない）の場合
      if (error.response && error.response.status === 404) {
        notFoundCount++;
        continue;
      }

      // その他のエラーの場合はログに記録
      console.warn(`プレイヤー ${player.riot_id} の検索中にエラー:`, error);
      continue;
    }
  }

  // 最も多くの参加者がいるゲームを選択
  let activeGame = null;
  let activeRegion = "";
  let maxCount = 0;
  let maxGameInfo = null;

  for (const [_, data] of gameCountMap.entries()) {
    if (data.count > maxCount) {
      maxCount = data.count;
      maxGameInfo = data;
    }
  }

  if (maxGameInfo) {
    activeGame = maxGameInfo.game;
    activeRegion = maxGameInfo.region;
    console.log(
      `最も多い参加者(${maxCount}人)が参加しているゲームID: ${activeGame.gameId}を追跡します`
    );
  }

  // すべてのプレイヤーがゲーム中でない場合
  if (notFoundCount === totalPlayers || !activeGame) {
    return {
      success: false,
      message:
        "参加者のアクティブなゲームが見つかりません。プレイヤーがゲーム中か確認してください。",
    };
  }

  // 試合IDを保存
  try {
    gameDB.updateGameSpectatorInfo(
      gameId,
      activeGame.gameId.toString(),
      activeRegion
    );
    gameDB.updateGameStatus(gameId, "TRACKING");

    const confirmGame = gameDB.getGame(gameId);
    console.log(
      `[startTrackingGame] 更新後の確認: status=${confirmGame?.status}, matchId=${confirmGame?.spectator_match_id}, region=${confirmGame?.spectator_region}`
    );
  } catch (dbError) {
    console.error("[startTrackingGame] DB更新エラー:", dbError);
    throw dbError;
  }

  // 試合情報を表示するEmbedを更新
  await updateGameTrackingEmbed(interaction, gameId, activeGame);

  // 定期的な追跡を開始
  setTimeout(() => {
    trackGameStatus(interaction, gameId, {
      matchId: activeGame.gameId.toString(),
      region: activeRegion,
      initialGameData: activeGame,
    });
  }, 2000); // 2秒の遅延

  return { success: true };
}

// 試合情報Embedの作成・更新
export async function updateGameTrackingEmbed(
  interaction: any,
  gameId: string,
  activeGame: any
) {
  try {
    console.log(`[updateGameTrackingEmbed] 開始: gameId=${gameId}`);

    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      console.error(
        `[updateGameTrackingEmbed] ゲーム情報が見つかりません: gameId=${gameId}`
      );
      return;
    }

    // 経過時間の計算
    const gameLength = activeGame.gameLength || 0;
    const gameStartTime = Math.floor(Date.now() / 1000) - gameLength;

    // Embedとボタンを生成
    const { embed, buttonRow } = await createGameTrackingEmbed(
      interaction.client,
      gameId,
      activeGame,
      gameLength,
      gameStartTime
    );

    // メッセージ更新
    try {
      const channel = await interaction.client.channels.fetch(game.channel_id);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return;
      }

      const message = await channel.messages.fetch(game.message_id);
      if (!message) {
        return;
      }

      // リトライ実装
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          await message.edit({
            embeds: [embed],
            components: [buttonRow],
          });
          success = true;
        } catch (editError) {
          console.error(
            `[updateGameTrackingEmbed] メッセージ更新エラー (試行 ${attempts}):`,
            editError
          );

          if (attempts >= maxAttempts) {
            throw editError;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (messageError) {
      console.error(
        "[updateGameTrackingEmbed] メッセージ関連エラー:",
        messageError
      );
      throw messageError;
    }
  } catch (error) {
    console.error("[updateGameTrackingEmbed] 試合情報更新エラー:", error);
    throw error;
  }
}

// 定期的な試合追跡処理
export function trackGameStatus(
  interaction: any,
  gameId: string,
  initialInfo?: {
    matchId: string;
    region: string;
    initialGameData: any;
  }
) {
  console.log(`[trackGameStatus] ゲームID: ${gameId} の追跡を開始します`);

  // まず現在のゲーム状態を確認
  const currentGame = gameDB.getGame(gameId);
  if (!currentGame || currentGame.status !== "TRACKING") {
    console.log(
      `[trackGameStatus] ゲーム ${gameId} は追跡状態ではありません: ${currentGame?.status}`
    );
    return null; // 追跡を開始しない
  }

  // タイマーID変数
  let apiUpdateTimer: NodeJS.Timer | null = null;

  // 更新間隔
  const apiUpdateInterval = 15000; // 15秒ごとにAPIから情報を更新

  // ゲーム情報とタイムスタンプ
  let lastGameData: any = initialInfo?.initialGameData || null;
  let lastUpdateTime = Date.now();
  let gameLength = lastGameData?.gameLength || 0;
  let gameStartTimestamp = lastUpdateTime - gameLength * 1000;
  let isRunning = true; // 追跡状態

  // 試合IDと地域を初期値から設定
  let spectatorMatchId = initialInfo?.matchId || "";
  let spectatorRegion = initialInfo?.region || "";

  // 初期情報がある場合は保存し直す
  if (initialInfo?.matchId && initialInfo?.region) {
    try {
      gameDB.updateGameSpectatorInfo(
        gameId,
        initialInfo.matchId,
        initialInfo.region
      );
      console.log(
        `[trackGameStatus] 初期情報をDBに再保存: matchId=${initialInfo.matchId}, region=${initialInfo.region}`
      );
    } catch (err) {
      console.error(`[trackGameStatus] 初期情報保存エラー:`, err);
    }
  }

  // API更新関数
  const updateGameData = async () => {
    console.log(`[updateGameData] ゲームID: ${gameId} の情報を更新します`);

    try {
      // ゲーム情報を確認
      const game = gameDB.getGame(gameId) as CustomGameData;
      if (!game || game.status !== "TRACKING") {
        console.log(
          `[updateGameData] ゲーム ${gameId} の追跡を停止します: ステータスが ${
            game?.status || "なし"
          } です`
        );
        stopTracking();
        return;
      }

      // 試合IDと地域を取得
      if (!spectatorMatchId) spectatorMatchId = game.spectator_match_id || "";
      if (!spectatorRegion) spectatorRegion = game.spectator_region || "";

      // 初期データを使用
      if ((!spectatorMatchId || !spectatorRegion) && initialInfo) {
        console.log(
          `[updateGameData] DB情報が不足しているため初期情報を使用します`
        );
        spectatorMatchId = initialInfo.matchId;
        spectatorRegion = initialInfo.region;

        // DBに再度保存
        try {
          gameDB.updateGameSpectatorInfo(
            gameId,
            spectatorMatchId,
            spectatorRegion
          );
        } catch (err) {
          console.error(
            `[updateGameData] スペクテーター情報の再保存に失敗:`,
            err
          );
        }
      }

      // スペクテーター情報がない場合は参加者から再取得を試みる
      if (!spectatorMatchId || !spectatorRegion) {
        const result = await refreshSpectatorInfoFromParticipants(gameId);

        if (result.success) {
          spectatorMatchId = result.matchId!;
          spectatorRegion = result.region!;
        } else {
          console.log(
            `[updateGameData] スペクテーター情報が見つからないため結果表示に移行します`
          );
          stopTracking();
          try {
            await displayGameResult(interaction, gameId);
          } catch (resultError) {
            console.error(`[updateGameData] 結果表示エラー:`, resultError);
          }
          return;
        }
      }

      const player = await getActivePlayer(gameId);
      if (!player) {
        console.log(
          `[updateGameData] プレイヤー情報がないため追跡を停止します`
        );
        stopTracking();
        return;
      }

      try {
        // アクティブゲームをチェック
        const activeGame = await RiotAPI.getActiveGame(
          spectatorRegion,
          player.puuid
        );

        if (activeGame) {
          // ゲームがトラッキング中であることを再確認
          const currentStatus = gameDB.getGame(gameId)?.status;
          if (currentStatus !== "TRACKING") {
            gameDB.updateGameStatus(gameId, "TRACKING");
            console.log(
              `[updateGameData] ゲーム ${gameId} のステータスを TRACKING に設定し直しました`
            );
          }

          // ゲームデータとタイムスタンプを更新
          lastGameData = activeGame;
          lastUpdateTime = Date.now();

          // gameLength の検証
          gameLength = activeGame.gameLength || 0;
          if (gameLength < 0 || gameLength > 10000) {
            console.warn(
              `[updateGameData] 異常なgameLength値: ${gameLength}秒 → 0にリセット`
            );
            gameLength = 0;
          }

          // ゲーム開始時刻を計算
          gameStartTimestamp = lastUpdateTime - gameLength * 1000;

          // Embedを更新
          await updateGameTrackingEmbed(interaction, gameId, activeGame);
        } else {
          // 試合終了
          console.log(
            `[updateGameData] ゲーム ${gameId} の試合が終了しました。結果表示に移行します`
          );
          stopTracking();
          await displayGameResult(interaction, gameId);
        }
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          // 試合が見つからない = 終了
          console.log(
            `[updateGameData] ゲーム ${gameId} の試合が見つかりません (404)。結果表示に移行します`
          );
          stopTracking();
          await displayGameResult(interaction, gameId);
        } else {
          // その他のエラー（追跡は継続）
          console.error(`[updateGameData] 試合情報取得エラー:`, error);
        }
      }
    } catch (error) {
      console.error(`[updateGameData] 試合追跡エラー:`, error);
    }
  };

  // 追跡を停止する関数
  const stopTracking = () => {
    console.log(`[stopTracking] ゲーム ${gameId} の追跡を停止します`);
    isRunning = false;

    // タイマーをクリア
    if (apiUpdateTimer) {
      clearInterval(apiUpdateTimer);
      apiUpdateTimer = null;
    }
  };

  // 初回のデータ取得を実行
  updateGameData();

  // APIデータ取得用の定期タイマーを設定
  apiUpdateTimer = setInterval(updateGameData, apiUpdateInterval);

  // 追跡停止関数を返す
  return stopTracking;
}

// 参加者情報からスペクテーター情報を再取得
async function refreshSpectatorInfoFromParticipants(gameId: string) {
  console.log(
    `[refreshSpectatorInfo] スペクテーター情報を参加者から再取得します`
  );

  const participants = gameDB.getParticipants(gameId);
  if (participants.length === 0) {
    console.log(`[refreshSpectatorInfo] 参加者がいないため追跡を停止します`);
    return { success: false };
  }

  for (const participant of participants) {
    const player = getPlayer(participant.user_id);
    if (!player) continue;

    try {
      const game = await RiotAPI.getActiveGame(player.region, player.puuid);

      if (game) {
        const spectatorMatchId = game.gameId.toString();
        const spectatorRegion = player.region;

        gameDB.updateGameSpectatorInfo(
          gameId,
          spectatorMatchId,
          spectatorRegion
        );

        return {
          success: true,
          matchId: spectatorMatchId,
          region: spectatorRegion,
        };
      }
    } catch (error) {
      console.warn(
        `[refreshSpectatorInfo] プレイヤーのアクティブゲーム取得エラー:`,
        error
      );
      continue;
    }
  }

  return { success: false };
}

// アクティブプレイヤーを取得
async function getActivePlayer(gameId: string) {
  const participants = gameDB.getParticipants(gameId);
  if (participants.length === 0) {
    return null;
  }

  for (const p of participants) {
    const player = getPlayer(p.user_id);
    if (player) {
      return player;
    }
  }

  return null;
}
