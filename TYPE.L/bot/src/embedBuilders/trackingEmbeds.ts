import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { getChampionNameById } from "../lib/ddragon";
import { formatGameTime } from "../lib/gameUtils";

// 追跡中のゲームEmbed作成
export async function createGameTrackingEmbed(
  client: any,
  gameId: string,
  activeGame: any,
  gameLength: number,
  gameStartTime: number
) {
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
  const { blueTeamStr, redTeamStr } = await processTeamInfo(activeGame);

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

  return { embed, buttonRow };
}

// チーム情報の処理
async function processTeamInfo(activeGame: any) {
  let blueTeam = [];
  let redTeam = [];

  // Riot APIの応答構造に合わせて適切に参加者を取得
  if (activeGame.participants && Array.isArray(activeGame.participants)) {
    blueTeam = activeGame.participants.filter((p: any) => p.teamId === 100) || [];
    redTeam = activeGame.participants.filter((p: any) => p.teamId === 200) || [];
  } else if (activeGame.players && Array.isArray(activeGame.players)) {
    blueTeam = activeGame.players.filter(
      (p: any) => p.team === "BLUE" || p.team === 100
    ) || [];
    redTeam = activeGame.players.filter(
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

  return { blueTeamStr, redTeamStr };
}
