import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { getChampionNameById } from "../lib/ddragon";
import { addStandardFooter } from "../lib/embedHelper";
import {
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
} from "../lib/embeds";
import { formatGameTime } from "../lib/gameUtils";
import { RiotAPI } from "../lib/riotApi";
import type { CustomGameData } from "../types/types";
import { createNewCustomGame } from "./gameCreation";

// ゲーム追跡処理
export const handleTrackGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // 参加者情報を取得
    const participants = gameDB.getParticipants(gameId);

    if (participants.length === 0) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("このゲームには参加者がいません。")],
      });
    }

    // ゲームステータスを「追跡中」に更新
    gameDB.updateGameStatus(gameId, "TRACKING");

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
    let activePlayer = null;
    let activeRegion = "";
    let maxCount = 0;
    let maxGameInfo = null;

    for (const [gameId, data] of gameCountMap.entries()) {
      if (data.count > maxCount) {
        maxCount = data.count;
        maxGameInfo = data;
      }
    }

    if (maxGameInfo) {
      activeGame = maxGameInfo.game;
      activePlayer = maxGameInfo.player;
      activeRegion = maxGameInfo.region;
      console.log(
        `最も多い参加者(${maxCount}人)が参加しているゲームID: ${activeGame.gameId}を追跡します`
      );
    }

    // すべてのプレイヤーがゲーム中でない場合
    if (notFoundCount === totalPlayers || !activeGame) {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "参加者のアクティブなゲームが見つかりません。プレイヤーがゲーム中か確認してください。"
          ),
        ],
      });
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
        `[handleTrackGame] 更新後の確認: status=${confirmGame?.status}, matchId=${confirmGame?.spectator_match_id}, region=${confirmGame?.spectator_region}`
      );
    } catch (dbError) {
      console.error("[handleTrackGame] DB更新エラー:", dbError);
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

    // 追跡開始成功を通知
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `ゲームの追跡を開始しました。\n試合情報を表示しています。`
        ),
      ],
    });
  } catch (error) {
    console.error("[handleTrackGame] ゲーム追跡エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("ゲーム追跡の開始中にエラーが発生しました。")],
    });
  }
};

// 追跡終了ハンドラー
export const handleEndTracking = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const game = gameDB.getGame(gameId);
    if (!game) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // チャンネルIDを保存
    const channelId = game.channel_id;

    // ゲームステータスを完了に更新
    gameDB.updateGameStatus(gameId, "COMPLETED");

    // 元のメッセージを更新
    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        const message = await channel.messages.fetch(game.message_id);
        if (message) {
          // 試合終了メッセージに更新
          const embed = new EmbedBuilder()
            .setColor(0x7289da)
            .setTitle("🛑 追跡終了")
            .setDescription(
              `ゲームID: ${gameId}\n試合追跡は手動で終了されました。`
            );

          // 標準フッターを追加
          await addStandardFooter(embed, interaction.client);

          await message.edit({
            embeds: [embed],
            components: [],
          });
        }
      }

      // 新しいカスタムゲームを作成
      const newGameId = await createNewCustomGame(
        interaction.client,
        channelId
      );

      await interaction.editReply({
        embeds: [
          createSuccessEmbed(
            `ゲーム追跡を終了しました。新しいカスタムゲームが作成されました！`
          ),
        ],
      });
    } catch (error) {
      console.error("メッセージ更新エラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed("メッセージの更新中にエラーが発生しました。"),
        ],
      });
    }
  } catch (error) {
    console.error("追跡終了エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("追跡終了処理中にエラーが発生しました。")],
    });
  }
};

// 結果表示ハンドラー
export const handleShowResult = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await displayGameResult(interaction, gameId);
    await interaction.editReply({
      embeds: [createSuccessEmbed("試合結果を更新しました。")],
    });
  } catch (error) {
    console.error("結果表示エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("試合結果の表示中にエラーが発生しました。")],
    });
  }
};

// 試合情報Embedの作成・更新
async function updateGameTrackingEmbed(
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

    // Embedを作成
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("🔴 試合進行中")
      .setDescription(
        `ゲームID: ${gameId}\nマッチID: ${activeGame.gameId}\nゲームタイプ: ${
          activeGame.gameType || "不明"
        }`
      )
      .addFields(
        {
          name: "ゲームモード",
          value: activeGame.gameMode || "カスタム",
          inline: true,
        },
        {
          name: "マップ",
          value: activeGame.mapId === 11 ? "サモナーズリフト" : "その他",
          inline: true,
        },
        {
          name: "経過時間",
          value: formatGameTime(gameLength) || "0:00",
          inline: true,
        }
      );

    // チーム情報の処理
    let blueTeam = [];
    let redTeam = [];

    // Riot APIの応答構造に合わせて適切に参加者を取得
    if (activeGame.participants && Array.isArray(activeGame.participants)) {
      blueTeam =
        activeGame.participants.filter((p: any) => p.teamId === 100) || [];
      redTeam =
        activeGame.participants.filter((p: any) => p.teamId === 200) || [];
    } else if (activeGame.players && Array.isArray(activeGame.players)) {
      blueTeam =
        activeGame.players.filter(
          (p: any) => p.team === "BLUE" || p.team === 100
        ) || [];
      redTeam =
        activeGame.players.filter(
          (p: any) => p.team === "RED" || p.team === 200
        ) || [];
    }

    // チーム情報の文字列作成
    let blueTeamStr = "";
    for (const player of blueTeam) {
      const champName = await getChampionNameById(player.championId);
      const summonerName = player.summonerName || player.riotId || "不明";
      blueTeamStr += `${champName} (${summonerName})\n`;
    }
    if (blueTeamStr === "") blueTeamStr = "情報を取得できませんでした";

    let redTeamStr = "";
    for (const player of redTeam) {
      const champName = await getChampionNameById(player.championId);
      const summonerName = player.summonerName || player.riotId || "不明";
      redTeamStr += `${champName} (${summonerName})\n`;
    }
    if (redTeamStr === "") redTeamStr = "情報を取得できませんでした";

    embed.addFields(
      {
        name: "🔵 ブルーチーム",
        value: blueTeamStr,
        inline: true,
      },
      {
        name: "🔴 レッドチーム",
        value: redTeamStr,
        inline: true,
      }
    );

    // 開始時間を追加
    const startTime = new Date(gameStartTime * 1000).toLocaleString("ja-JP");
    embed.addFields({
      name: "開始時間",
      value: startTime,
      inline: false,
    });

    // 標準フッターを追加
    await addStandardFooter(embed, interaction.client);

    // ボタン作成
    const endTrackingButton = new ButtonBuilder()
      .setCustomId(`endtrack_${gameId}`)
      .setLabel("追跡終了")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("⏹️");

    const resultButton = new ButtonBuilder()
      .setCustomId(`result_${gameId}`)
      .setLabel("結果表示")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🏆");

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      endTrackingButton,
      resultButton
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
function trackGameStatus(
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
  const apiUpdateInterval = 15000; // 30秒ごとにAPIから情報を更新

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

      // スペクテーター情報が不足している場合
      if (!spectatorMatchId || !spectatorRegion) {
        console.log(
          `[updateGameData] スペクテーター情報が不足しています。参加者から再取得します`
        );

        // 参加者情報から再取得
        const participants = gameDB.getParticipants(gameId);
        if (participants.length === 0) {
          console.log(`[updateGameData] 参加者がいないため追跡を停止します`);
          stopTracking();
          return;
        }

        for (const participant of participants) {
          const player = getPlayer(participant.user_id);
          if (!player) continue;

          try {
            const game = await RiotAPI.getActiveGame(
              player.region,
              player.puuid
            );

            if (game) {
              spectatorMatchId = game.gameId.toString();
              spectatorRegion = player.region;
              gameDB.updateGameSpectatorInfo(
                gameId,
                spectatorMatchId,
                spectatorRegion
              );
              break;
            }
          } catch (error) {
            console.warn(
              `[updateGameData] プレイヤーのアクティブゲーム取得エラー:`,
              error
            );
            continue;
          }
        }

        // 再取得してもスペクテーター情報がない場合
        if (!spectatorMatchId || !spectatorRegion) {
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

      // 参加者からプレイヤー情報を取得
      const participants = gameDB.getParticipants(gameId);
      if (participants.length === 0) {
        console.log(`[updateGameData] 参加者がいないため追跡を停止します`);
        stopTracking();
        return;
      }

      let player = null;
      for (const p of participants) {
        const pl = getPlayer(p.user_id);
        if (pl) {
          player = pl;
          break;
        }
      }

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

// 試合結果表示
export async function displayGameResult(interaction: any, gameId: string) {
  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      throw new Error("ゲーム情報が見つかりません");
    }

    // 試合IDと地域を取得
    const spectatorMatchId = game.spectator_match_id;
    const spectatorRegion = game.spectator_region;

    if (!spectatorMatchId || !spectatorRegion) {
      throw new Error("試合情報が不足しています");
    }

    // チャンネルとメッセージを取得
    const channel = await interaction.client.channels.fetch(game.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("チャンネルが見つかりません");
    }

    const message = await channel.messages.fetch(game.message_id);
    if (!message) {
      throw new Error("メッセージが見つかりません");
    }

    // ゲームの結果を取得するためのAPIコール
    try {
      // 試合IDと地域から結果情報を取得
      console.log(
        `[displayGameResult] マッチID: ${spectatorMatchId}, 地域: ${spectatorRegion} の結果を取得します`
      );

      // 参加者情報を取得
      const participants = gameDB.getParticipants(gameId);
      if (participants.length === 0) {
        throw new Error("参加者情報が見つかりません");
      }

      // プレイヤー情報を取得
      let player = null;
      for (const p of participants) {
        const pl = getPlayer(p.user_id);
        if (pl) {
          player = pl;
          break;
        }
      }

      if (!player) {
        throw new Error("プレイヤー情報が見つかりません");
      }

      // 最新の試合結果を取得
      const matches = await RiotAPI.getRecentMatches(
        player.puuid,
        spectatorRegion,
        1
      );

      if (!matches || matches.length === 0) {
        throw new Error("最近の試合が見つかりません");
      }

      // 最新の試合情報を取得
      const matchId = matches[0];
      const matchDetails = await RiotAPI.getMatchDetails(
        matchId, // 最初にマッチID
        spectatorRegion // 次に地域
      );

      if (!matchDetails) {
        throw new Error("試合詳細が取得できません");
      }

      // 試合結果Embedを作成
      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("🏆 試合結果")
        .setDescription(`ゲームID: ${gameId}\nマッチID: ${matchId}`);

      // 試合の基本情報
      const gameCreation = new Date(
        matchDetails.info.gameCreation
      ).toLocaleString("ja-JP");
      const gameDuration = formatGameTime(matchDetails.info.gameDuration);

      embed.addFields(
        {
          name: "ゲームタイプ",
          value: matchDetails.info.gameType || "不明",
          inline: true,
        },
        { name: "開始時間", value: gameCreation, inline: true },
        { name: "試合時間", value: gameDuration, inline: true }
      );

      // チーム情報の処理
      const blueTeam = matchDetails.info.teams.find(
        (team: any) => team.teamId === 100
      );
      const redTeam = matchDetails.info.teams.find(
        (team: any) => team.teamId === 200
      );

      // 勝敗情報
      const blueWin = blueTeam?.win ? "勝利 ✅" : "敗北 ❌";
      const redWin = redTeam?.win ? "勝利 ✅" : "敗北 ❌";

      embed.addFields(
        { name: "🔵 ブルーチーム", value: blueWin, inline: true },
        { name: "🔴 レッドチーム", value: redWin, inline: true }
      );

      // プレイヤー情報の処理
      let bluePlayers = "";
      let redPlayers = "";

      // 参加者データをマッピング（プレイヤー検索用）
      const participantsMap = new Map();
      const summNameMap = new Map(); // サモナー名でのマッピング追加

      // ゲーム参加者情報をログ出力
      console.log(
        `[displayGameResult] ゲームID: ${gameId} の参加者情報を取得します`
      );
      const botParticipants = gameDB.getParticipants(gameId);
      console.log(
        `[displayGameResult] ボット登録済み参加者: ${botParticipants.length}人`
      );

      // 複数のキーでマッピング
      for (const participant of botParticipants) {
        // プレイヤー情報をログ出力
        console.log(
          `[displayGameResult] 参加者: ${participant.riot_id}#${
            participant.tagline
          }, PUUID: ${participant.puuid?.substring(0, 8)}...`
        );

        if (participant.puuid) {
          participantsMap.set(participant.puuid, {
            riot_id: participant.riot_id,
            tagline: participant.tagline,
            user_id: participant.user_id,
          });
        }

        // サモナー名でもマッピング (小文字に変換して比較を容易にする)
        const normalizedName = participant.riot_id
          .toLowerCase()
          .replace(/\s+/g, "");
        summNameMap.set(normalizedName, {
          riot_id: participant.riot_id,
          tagline: participant.tagline,
          user_id: participant.user_id,
        });
      }

      // API取得プレイヤー情報をログ出力
      console.log(
        `[displayGameResult] マッチプレイヤー数: ${matchDetails.info.participants.length}人`
      );

      // 各プレイヤーのKDAを取得
      for (const participant of matchDetails.info.participants) {
        const champName = await getChampionNameById(participant.championId);
        const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;

        // プレイヤーのPUUIDをログ出力 (存在する場合)
        console.log(
          `[displayGameResult] マッチプレイヤー: ${
            participant.summonerName
          }, PUUID: ${participant.puuid?.substring(0, 8) || "不明"}, チーム: ${
            participant.teamId
          }`
        );

        // プレイヤーの表示名を決定する複数の手段を試行
        let displayName = participant.summonerName || "不明";
        let matchFound = false;

        // 1. PUUIDによるマッチング (最も正確)
        if (participant.puuid && participantsMap.has(participant.puuid)) {
          const playerInfo = await RiotAPI.getGamenameTagline(
            participant.puuid
          );
          displayName = `${playerInfo.gameName}#${playerInfo.tagLine}`;
          matchFound = true;
          console.log(
            `[displayGameResult] PUUIDでマッチング成功: ${displayName}`
          );
        }
        // 2. サモナー名による拡張マッチング
        else if (participant.summonerName) {
          const normalizedName = participant.summonerName
            .toLowerCase()
            .replace(/\s+/g, "");

          // 2.1 完全一致を試す
          if (summNameMap.has(normalizedName)) {
            const playerInfo = summNameMap.get(normalizedName);
            displayName = `${playerInfo.riot_id}#${playerInfo.tagline}`;
            matchFound = true;
            console.log(
              `[displayGameResult] 名前で完全マッチング成功: ${displayName}`
            );
          }
          // 2.2 部分一致を試す (より緩和したマッチング)
          else {
            let bestMatchScore = 0;
            let bestMatch = null;

            for (const [key, playerInfo] of summNameMap.entries()) {
              // 部分一致のスコアを計算 - 相互に部分一致をチェック
              let matchScore = 0;
              if (normalizedName.includes(key)) matchScore += 3;
              if (key.includes(normalizedName)) matchScore += 2;

              // 先頭が一致するケースはさらに高スコア
              if (
                normalizedName.startsWith(key) ||
                key.startsWith(normalizedName)
              ) {
                matchScore += 2;
              }

              // 文字数の差が少ないほど良いマッチ
              const lengthDiff = Math.abs(normalizedName.length - key.length);
              if (lengthDiff <= 2) matchScore += 1;

              // より良いマッチを保存
              if (matchScore > bestMatchScore) {
                bestMatchScore = matchScore;
                bestMatch = playerInfo;
              }
            }

            // スコアが一定以上のマッチがあれば使用
            if (bestMatchScore >= 3 && bestMatch) {
              displayName = `${bestMatch.riot_id}#${bestMatch.tagline}`;
              matchFound = true;
              console.log(
                `[displayGameResult] 拡張マッチングで成功(スコア:${bestMatchScore}): ${displayName}`
              );
            }
          }
        }

        // 3. レーン情報に基づく推測マッチング (チーム分けがされている場合のみ)
        if (
          !matchFound &&
          (participant.teamId === 100 || participant.teamId === 200)
        ) {
          const teamLetter = participant.teamId === 100 ? "A" : "B";
          const possiblePlayers = botParticipants.filter(
            (p) => p.team === teamLetter
          );

          // チーム + レーンでマッチング
          if (participant.lane && possiblePlayers.length > 0) {
            const lanePlayer = possiblePlayers.find((p) => {
              // レーン情報を正規化して比較
              const pLane = p.lane?.toUpperCase() || "FILL";
              let participantLane = participant.lane.toUpperCase();

              // API側のBOTTOMとSUPPORTを正確に区別
              if (
                participantLane === "BOTTOM" &&
                participant.role?.includes("SUPPORT")
              ) {
                participantLane = "SUPPORT";
              }

              return pLane === participantLane || pLane === "FILL";
            });

            if (lanePlayer) {
              displayName = `${lanePlayer.riot_id}#${lanePlayer.tagline}`;
              matchFound = true;
              console.log(
                `[displayGameResult] レーン情報でマッチング成功: ${displayName}`
              );
            }
          }
        }

        if (!matchFound) {
          console.log(
            `[displayGameResult] マッチング失敗: ${
              participant.summonerName || "不明"
            }`
          );
        }

        // 新しい表示形式
        const playerInfo = `${champName} (${displayName}): ${kda}\n`;

        // チームに追加
        if (participant.teamId === 100) {
          bluePlayers += playerInfo;
        } else {
          redPlayers += playerInfo;
        }
      }

      // プレイヤーがいない場合の表示
      if (!bluePlayers) bluePlayers = "情報なし";
      if (!redPlayers) redPlayers = "情報なし";

      embed.addFields(
        {
          name: "🔵 ブルーチームプレイヤー",
          value: bluePlayers,
          inline: true,
        },
        {
          name: "🔴 レッドチームプレイヤー",
          value: redPlayers,
          inline: true,
        }
      );

      // 標準フッターを追加
      await addStandardFooter(embed, interaction.client);

      // 新しいカスタムゲームを作成するボタン
      const newGameButton = new ButtonBuilder()
        .setCustomId(`newgame_${game.channel_id}`)
        .setLabel("新しいゲームを作成")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎮");

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newGameButton
      );

      // メッセージを更新
      await message.edit({
        embeds: [embed],
        components: [buttonRow],
      });

      // ゲームステータスを完了に更新
      gameDB.updateGameStatus(gameId, "COMPLETED");

      // ゲーム結果をデータベースに保存
      try {
        const blueTeamWin = blueTeam.win;
        const gameDuration = matchDetails.info.gameDuration;

        // ゲーム全体の結果を保存
        gameDB.saveGameResult(
          gameId,
          game.server_id,
          matchId,
          blueTeamWin,
          gameDuration
        );

        // 各プレイヤーの結果を保存
        for (const participant of matchDetails.info.participants) {
          // 変数を再計算
          const champName = await getChampionNameById(participant.championId);

          // プレイヤー情報を特定
          let playerInfo = null;

          // 1. PUUIDによるマッチング
          if (participant.puuid && participantsMap.has(participant.puuid)) {
            playerInfo = participantsMap.get(participant.puuid);
          }
          // 2. サモナー名によるマッチング
          else if (participant.summonerName) {
            const normalizedName = participant.summonerName
              .toLowerCase()
              .replace(/\s+/g, "");
            if (summNameMap.has(normalizedName)) {
              playerInfo = summNameMap.get(normalizedName);
            }
          }

          // 3. レーン情報に基づくマッチング
          if (
            !playerInfo &&
            (participant.teamId === 100 || participant.teamId === 200)
          ) {
            const teamLetter = participant.teamId === 100 ? "A" : "B";
            const teamPlayers = botParticipants.filter(
              (p) => p.team === teamLetter
            );

            if (participant.lane && teamPlayers.length > 0) {
              const lanePlayer = teamPlayers.find((p) => {
                const pLane = p.lane?.toUpperCase() || "FILL";
                let participantLane = participant.lane.toUpperCase();

                if (
                  participantLane === "BOTTOM" &&
                  participant.role?.includes("SUPPORT")
                ) {
                  participantLane = "SUPPORT";
                }

                return pLane === participantLane || pLane === "FILL";
              });

              if (lanePlayer) {
                playerInfo = {
                  user_id: lanePlayer.user_id,
                  riot_id: lanePlayer.riot_id,
                  tagline: lanePlayer.tagline,
                };
              }
            }
          }

          // プレイヤー情報が特定できた場合のみDBに保存
          if (playerInfo && playerInfo.user_id) {
            try {
              gameDB.savePlayerGameResult(
                gameId,
                game.server_id,
                playerInfo.user_id,
                matchId,
                participant.championId,
                champName,
                participant.teamId === 100 ? "BLUE" : "RED",
                participant.lane || "UNKNOWN",
                participant.win,
                participant.kills,
                participant.deaths,
                participant.assists
              );

              console.log(
                `[displayGameResult] プレイヤー ${playerInfo.riot_id}#${playerInfo.tagline} の結果を保存しました`
              );
            } catch (playerError) {
              console.error(
                `[displayGameResult] プレイヤー結果保存エラー:`,
                playerError
              );
            }
          } else {
            console.log(
              `[displayGameResult] プレイヤー情報が特定できないため結果を保存しません: ${
                participant.summonerName || "不明"
              }`
            );
          }
        }

        console.log(
          `[displayGameResult] ゲームID:${gameId}の結果をデータベースに保存しました`
        );
      } catch (dbError) {
        console.error("[displayGameResult] ゲーム結果保存エラー:", dbError);
        // 結果表示は続行
      }

      return true;
    } catch (apiError) {
      console.error("[displayGameResult] 試合結果取得エラー:", apiError);

      // エラーが発生した場合のフォールバック処理
      const fallbackEmbed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle("⚠️ 試合結果取得エラー")
        .setDescription(
          `ゲームID: ${gameId}\n試合結果の取得に失敗しました。\n` +
            `試合情報: マッチID=${spectatorMatchId}, 地域=${spectatorRegion}`
        )
        .addFields({
          name: "エラー詳細",
          value: apiError instanceof Error ? apiError.message : "不明なエラー",
          inline: false,
        });

      // 標準フッターを追加
      await addStandardFooter(fallbackEmbed, interaction.client);

      // 新しいカスタムゲームを作成するボタン
      const newGameButton = new ButtonBuilder()
        .setCustomId(`newgame_${game.channel_id}`)
        .setLabel("新しいゲームを作成")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎮");

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        newGameButton
      );

      // メッセージを更新
      await message.edit({
        embeds: [fallbackEmbed],
        components: [buttonRow],
      });

      // ゲームステータスを完了に更新
      gameDB.updateGameStatus(gameId, "COMPLETED");

      return false;
    }
  } catch (error) {
    console.error("[displayGameResult] 試合結果表示エラー:", error);
    throw error;
  }
}
