import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags } from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { getChampionNameById } from "../lib/ddragon";
import { createErrorEmbed, createSuccessEmbed } from "../lib/embeds";
import { formatGameTime } from "../lib/gameUtils";
import { RiotAPI } from "../lib/riotApi";
import { matchPlayerByLane, matchPlayerByName, matchPlayerByPUUID } from "../utils/playerMatching";

// 結果表示ハンドラー
export async function handleShowResult(interaction: any, gameId: string) {
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
      // 参加者情報を取得
      const botParticipants = gameDB.getParticipants(gameId);
      if (botParticipants.length === 0) {
        throw new Error("参加者情報が見つかりません");
      }

      // プレイヤー情報を取得
      const player = await getFirstValidPlayer(botParticipants);
      if (!player) {
        throw new Error("プレイヤー情報が見つかりません");
      }

      // 最新の試合結果を取得
      const matches = await RiotAPI.getRecentMatches(player.puuid, spectatorRegion, 1);
      if (!matches || matches.length === 0) {
        throw new Error("最近の試合が見つかりません");
      }

      // 最新の試合情報を取得
      const matchId = matches[0];
      const matchDetails = await RiotAPI.getMatchDetails(matchId, spectatorRegion);
      if (!matchDetails) {
        throw new Error("試合詳細が取得できません");
      }

      // 参加者データをマッピング（プレイヤー検索用）
      const { participantsMap, summNameMap } = preparePlayerMapping(botParticipants);

      // 試合結果Embedを作成
      const embed = await createGameResultEmbed(
        interaction.client,
        gameId,
        matchId,
        matchDetails,
        botParticipants,
        participantsMap,
        summNameMap
      );

      // 新しいカスタムゲームを作成するボタン
      const newGameButton = new ButtonBuilder()
        .setCustomId(`newgame_${game.channel_id}`)
        .setLabel("新しいゲームを作成")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎮");

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(newGameButton);

      // メッセージを更新
      await message.edit({
        embeds: [embed],
        components: [buttonRow],
      });

      // ゲームステータスを完了に更新
      gameDB.updateGameStatus(gameId, "COMPLETED");

      // ゲーム結果をデータベースに保存
      await saveGameResults(gameId, matchId, matchDetails, botParticipants, participantsMap, summNameMap);

      return true;
    } catch (apiError) {
      console.error("[displayGameResult] 試合結果取得エラー:", apiError);

      // エラーが発生した場合のフォールバック処理
      const fallbackEmbed = createErrorResultEmbed(
        interaction.client,
        gameId,
        spectatorMatchId,
        spectatorRegion,
        apiError
      );

      // 新しいカスタムゲームを作成するボタン
      const newGameButton = new ButtonBuilder()
        .setCustomId(`newgame_${game.channel_id}`)
        .setLabel("新しいゲームを作成")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎮");

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(newGameButton);

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

// ゲーム結果のEmbed作成
async function createGameResultEmbed(
  client: any,
  gameId: string,
  matchId: string,
  matchDetails: any,
  botParticipants: any[],
  participantsMap: Map<string, any>,
  summNameMap: Map<string, any>
) {
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle("🏆 試合結果")
    .setDescription(`ゲームID: ${gameId}\nマッチID: ${matchId}`);

  // 試合の基本情報
  const gameCreation = new Date(matchDetails.info.gameCreation).toLocaleString("ja-JP");
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
  const blueTeam = matchDetails.info.teams.find((team: any) => team.teamId === 100);
  const redTeam = matchDetails.info.teams.find((team: any) => team.teamId === 200);

  // 勝敗情報
  const blueWin = blueTeam?.win ? "勝利 ✅" : "敗北 ❌";
  const redWin = redTeam?.win ? "勝利 ✅" : "敗北 ❌";

  embed.addFields(
    { name: "🔵 ブルーチーム", value: blueWin, inline: true },
    { name: "🔴 レッドチーム", value: redWin, inline: true }
  );

  // プレイヤー情報の処理
  const { bluePlayers, redPlayers } = await processPlayersInfo(
    matchDetails.info.participants,
    botParticipants,
    participantsMap,
    summNameMap
  );

  embed.addFields(
    {
      name: "🔵 ブルーチームプレイヤー",
      value: bluePlayers || "情報なし",
      inline: true,
    },
    {
      name: "🔴 レッドチームプレイヤー",
      value: redPlayers || "情報なし",
      inline: true,
    }
  );

  return embed;
}

// エラー表示用Embed作成
async function createErrorResultEmbed(client: any, gameId: string, matchId: string, region: string, error: any) {
  const fallbackEmbed = new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle("⚠️ 試合結果取得エラー")
    .setDescription(
      `ゲームID: ${gameId}\n試合結果の取得に失敗しました。\n` +
      `試合情報: マッチID=${matchId}, 地域=${region}`
    )
    .addFields({
      name: "エラー詳細",
      value: error instanceof Error ? error.message : "不明なエラー",
      inline: false,
    });

  return fallbackEmbed;
}

// 参加者データのマッピングを準備
function preparePlayerMapping(botParticipants: any[]) {
  const participantsMap = new Map();
  const summNameMap = new Map();

  // ゲーム参加者情報をログ出力
  console.log(`[preparePlayerMapping] 参加者数: ${botParticipants.length}人`);

  // 複数のキーでマッピング
  for (const participant of botParticipants) {
    if (participant.puuid) {
      participantsMap.set(participant.puuid, {
        riot_id: participant.riot_id,
        tagline: participant.tagline,
        user_id: participant.user_id,
      });
    }

    // サモナー名でもマッピング (小文字に変換して比較を容易にする)
    const normalizedName = participant.riot_id.toLowerCase().replace(/\s+/g, "");
    summNameMap.set(normalizedName, {
      riot_id: participant.riot_id,
      tagline: participant.tagline,
      user_id: participant.user_id,
    });
  }

  return { participantsMap, summNameMap };
}

// プレイヤー情報の処理
async function processPlayersInfo(participants: any[], botParticipants: any[], participantsMap: Map<string, any>, summNameMap: Map<string, any>) {
  let bluePlayers = "";
  let redPlayers = "";

  // API取得プレイヤー情報をログ出力
  console.log(`[processPlayersInfo] マッチプレイヤー数: ${participants.length}人`);

  // 各プレイヤーの情報を処理
  for (const participant of participants) {
    const champName = await getChampionNameById(participant.championId);
    const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;

    // プレイヤーのマッチング
    const { displayName, matchFound } = await matchPlayer(
      participant,
      botParticipants,
      participantsMap,
      summNameMap
    );

    // 表示形式
    const playerInfo = `${champName} (${displayName}): ${kda}\n`;

    // チームに追加
    if (participant.teamId === 100) {
      bluePlayers += playerInfo;
    } else {
      redPlayers += playerInfo;
    }
  }

  return { bluePlayers, redPlayers };
}

// プレイヤーとカスタムゲーム参加者のマッチング
async function matchPlayer(
  participant: any,
  botParticipants: any[],
  participantsMap: Map<string, any>,
  summNameMap: Map<string, any>
) {
  // PUUIDでのマッチング
  const puuidMatch = await matchPlayerByPUUID(participant, participantsMap);
  if (puuidMatch.matchFound) {
    return puuidMatch;
  }

  // サモナー名での完全一致マッチング
  if (participant.summonerName) {
    const nameMatch = matchPlayerByName(participant.summonerName, summNameMap);
    if (nameMatch.matchFound) {
      return nameMatch;
    }
  }

  // レーン+チーム情報でのマッチング
  const laneMatch = matchPlayerByLane(participant, botParticipants);
  if (laneMatch.matchFound) {
    return laneMatch;
  }

  // マッチングできなかった場合
  return {
    displayName: participant.summonerName || "不明",
    matchFound: false
  };
}

// ゲーム結果の保存
async function saveGameResults(
  gameId: string,
  matchId: string,
  matchDetails: any,
  botParticipants: any[],
  participantsMap: Map<string, any>,
  summNameMap: Map<string, any>
) {
  try {
    // チーム情報
    const blueTeam = matchDetails.info.teams.find((team: any) => team.teamId === 100);
    const blueTeamWin = blueTeam.win;
    const gameDuration = matchDetails.info.gameDuration;

    // ゲーム全体の結果を保存
    try {
      gameDB.saveGameResult(gameId, matchId, blueTeamWin, gameDuration);
      console.log(`[saveGameResults] ゲームID:${gameId}の結果を保存しました`);
    } catch (error) {
      console.log(`[saveGameResults] ゲーム結果は既に保存されている可能性があります:`, error);
    }

    // 各プレイヤーの結果を保存
    for (const participant of matchDetails.info.participants) {
      // プレイヤー情報を特定
      const playerInfo = await findPlayerInfo(
        participant,
        botParticipants,
        participantsMap,
        summNameMap
      );

      if (playerInfo) {
        const champName = await getChampionNameById(participant.championId);

        try {
          // プレイヤー結果を保存
          savePlayerResult(matchId, playerInfo, participant, champName);
        } catch (playerError) {
          console.error(`[saveGameResults] プレイヤー結果保存エラー:`, playerError);
        }
      } else {
        console.log(
          `[saveGameResults] プレイヤー情報が特定できないため結果を保存しません: ${
            participant.summonerName || "不明"
          }`
        );
      }
    }
  } catch (dbError) {
    console.error("[saveGameResults] ゲーム結果保存エラー:", dbError);
  }
}

// プレイヤー情報を検索
async function findPlayerInfo(
  participant: any,
  botParticipants: any[],
  participantsMap: Map<string, any>,
  summNameMap: Map<string, any>
) {
  // PUUIDによるマッチング
  if (participant.puuid && participantsMap.has(participant.puuid)) {
    return participantsMap.get(participant.puuid);
  }

  // サモナー名によるマッチング
  if (participant.summonerName) {
    const normalizedName = participant.summonerName.toLowerCase().replace(/\s+/g, "");
    if (summNameMap.has(normalizedName)) {
      return summNameMap.get(normalizedName);
    }
  }

  // レーン情報に基づくマッチング
  if ((participant.teamId === 100 || participant.teamId === 200)) {
    const teamLetter = participant.teamId === 100 ? "A" : "B";
    const teamPlayers = botParticipants.filter(p => p.team === teamLetter);

    if (participant.lane && teamPlayers.length > 0) {
      const lanePlayer = teamPlayers.find(p => {
        const pLane = p.lane?.toUpperCase() || "FILL";
        let participantLane = participant.lane.toUpperCase();

        if (participantLane === "BOTTOM" && participant.role?.includes("SUPPORT")) {
          participantLane = "SUPPORT";
        }

        return pLane === participantLane || pLane === "FILL";
      });

      if (lanePlayer) {
        return {
          user_id: lanePlayer.user_id,
          riot_id: lanePlayer.riot_id,
          tagline: lanePlayer.tagline,
        };
      }
    }
  }

  return null;
}

// プレイヤーの結果を保存
function savePlayerResult(matchId: string, playerInfo: any, participant: any, champName: string) {
  gameDB.savePlayerGameResult(
    matchId,                                  // matchId
    playerInfo.user_id,                       // userId
    participant.championId,                   // championId
    champName,                                // championName
    participant.teamId === 100 ? "BLUE" : "RED", // team
    participant.lane || "UNKNOWN",            // position
    !!participant.win,                        // 明示的にboolean型に変換
    participant.kills,                        // kills
    participant.deaths,                       // deaths
    participant.assists,                      // assists
    participant.goldEarned || null,           // goldEarned (あれば)
    participant.visionScore || null,          // visionScore (あれば)
    participant.totalMinionsKilled || null    // cs (あれば)
  );

  console.log(
    `[savePlayerResult] プレイヤー ${playerInfo.riot_id}#${playerInfo.tagline} の結果を保存しました`
  );
}

// 有効なプレイヤー情報を取得
async function getFirstValidPlayer(participants: any[]) {
  for (const p of participants) {
    const player = getPlayer(p.user_id);
    if (player) {
      return player;
    }
  }
  return null;
}
