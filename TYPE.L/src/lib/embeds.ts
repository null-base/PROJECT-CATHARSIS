import { EmbedBuilder } from "discord.js";
import type { ParticipantData, PlayerData } from "../types/types";
import { BOT_DEVELOPER_ID, BOT_DEVELOPER_NAME, BOT_WEBSITE } from "./config";

// フッター用の共通関数
const addStandardFooter = (embed: EmbedBuilder) => {
  return embed
    .setFooter({
      text: `Powered by @${BOT_DEVELOPER_NAME} • ${BOT_WEBSITE}`,
      iconURL: `https://cdn.discordapp.com/avatars/${BOT_DEVELOPER_ID}/953d512ef19ef1e915fe733fa637b67e.webp`,
    })
};

// チーム分け方法の表示名を取得する関数
export function getMethodName(method: string): string {
  const methodNames: Record<string, string> = {
    random: "ランダム",
    winrate: "勝率バランス",
    level: "レベル均等",
    rank: "ランク均等",
    lane: "レーン実力",
  };

  return methodNames[method] || "ランダム";
}

// カスタムゲーム募集Embed (balanceMethod パラメータを追加)
export const createCustomGameEmbed = (
  gameId: string,
  participants: ParticipantData[],
  balanceMethod: string = "random"
) => {
  // レーン別の参加者を整理
  const lanes = {
    TOP: [] as ParticipantData[],
    JUNGLE: [] as ParticipantData[],
    MID: [] as ParticipantData[],
    BOTTOM: [] as ParticipantData[],
    SUPPORT: [] as ParticipantData[],
    FILL: [] as ParticipantData[],
  };

  for (const p of participants) {
    if (p.lane in lanes) {
      lanes[p.lane as keyof typeof lanes].push(p);
    } else {
      lanes.FILL.push(p);
    }
  }

  // 参加者リスト文字列を作成
  let participantsStr = "";

  if (participants.length === 0) {
    participantsStr = "まだ誰も参加していません";
  } else {
    for (const [lane, players] of Object.entries(lanes)) {
      if (players.length === 0) continue;

      participantsStr += `**${lane}**\n`;
      for (const p of players) {
        const teamBadge = p.team ? `[${p.team}] ` : "";
        participantsStr += `${teamBadge}${p.riot_id}#${p.tagline}\n`;
      }
      participantsStr += "\n";
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("🎮 カスタムゲーム募集中")
    .setDescription(`参加ボタンを押して、希望レーンを選択してください。`)
    .addFields(
      {
        name: `参加者 (${participants.length})`,
        value: participantsStr || "まだ誰も参加していません",
        inline: false,
      },
      { name: "ゲームID", value: `\`${gameId}\``, inline: true },
      { name: "ステータス", value: `🟢 募集中`, inline: true },
      // チーム分け方法を表示
      {
        name: "チーム分け方式",
        value: `📊 ${getMethodName(balanceMethod)}`,
        inline: true,
      }
    );

  // 標準フッターを追加
  return addStandardFooter(embed);
};

export const createRegisterEmbed = (player: PlayerData) => {
  return addStandardFooter(
    new EmbedBuilder()
      .setTitle("✅ 登録完了")
      .setDescription(`${player.riot_id}#${player.tagline}`)
      .addFields(
        {
          name: "🌍 リージョン",
          value: player.region.toUpperCase(),
          inline: true,
        },
        { name: "📊 レベル", value: player.level.toString(), inline: true },
        {
          name: "🏅 ソロランク",
          value:
            player.solo_tier !== "UNRANKED"
              ? `${player.solo_tier} ${player.solo_division} (${player.solo_lp}LP)`
              : "未ランク",
          inline: true,
        },
        {
          name: "🎖️ フレックスランク",
          value:
            player.flex_tier !== "UNRANKED"
              ? `${player.flex_tier} ${player.flex_division} (${player.flex_lp}LP)`
              : "未ランク",
          inline: true,
        }
      )
      .setColor(0x00ff00)
  );
};

export const createProfileEmbed = (player: PlayerData, stats: any) => {
  const laneStats = stats.topLanes
    .map((lane: string) => `• ${lane}`)
    .join("\n");

  return addStandardFooter(
    new EmbedBuilder()
      .setTitle(`${player.riot_id}#${player.tagline}`)
      .setColor(0x00ff00) // 固定色に変更
      .addFields(
        {
          name: "🌍 リージョン",
          value: player.region.toUpperCase(),
          inline: true,
        },
        { name: "📊 レベル", value: player.level.toString(), inline: true },
        {
          name: "🏅 ソロランク",
          value:
            player.solo_tier !== "UNRANKED"
              ? `${player.solo_tier} ${player.solo_division} (${player.solo_lp}LP)`
              : "未ランク",
          inline: true,
        },
        {
          name: "🎖️ フレックスランク",
          value:
            player.flex_tier !== "UNRANKED"
              ? `${player.flex_tier} ${player.flex_division} (${player.flex_lp}LP)`
              : "未ランク",
          inline: true,
        },
        {
          name: "📈 統計",
          value: `🎮 ${stats.total.games}戦\n🏆 ${stats.total.winRate}% WR\n⚔️ ${stats.total.kda} KDA`,
          inline: false,
        },
        {
          name: "🏆 チャンピオン (TOP3)",
          value: stats.topChampions.join("\n") || "データなし",
          inline: false,
        },
        {
          name: "🌐 レーン統計 (TOP3)",
          value: laneStats || "データなし",
          inline: false,
        }
      )
  );
};

export const createBalanceEmbed = (teamA: any[], teamB: any[]) => {
  return addStandardFooter(
    new EmbedBuilder()
      .setTitle("⚖️ チームバランス結果")
      .setColor(0x7289da)
      .addFields(
        {
          name: "Team A",
          value: teamA.map((p) => `• ${p.riot_id}#${p.tagline}`).join("\n"),
          inline: true,
        },
        {
          name: "Team B",
          value: teamB.map((p) => `• ${p.riot_id}#${p.tagline}`).join("\n"),
          inline: true,
        }
      )
  );
};

export const createErrorEmbed = (message: string) => {
  return addStandardFooter(
    new EmbedBuilder().setColor(0xff0000).setDescription(`❌ ${message}`)
  );
};

// createCustomBalanceEmbed 関数
export const createCustomBalanceEmbed = (
  teamA: ParticipantData[],
  teamB: ParticipantData[]
) => {
  const formatTeam = (team: ParticipantData[]) => {
    return team
      .map((p) => {
        const lane = p.lane !== "FILL" ? `[${p.lane}] ` : "";
        return `${lane}${p.riot_id}#${p.tagline}`;
      })
      .join("\n");
  };

  return addStandardFooter(
    new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("⚖️ チームバランス結果")
      .addFields(
        {
          name: "🟦 TEAM BLUE",
          value: formatTeam(teamA) || "メンバーなし",
          inline: true,
        },
        {
          name: "🟥 TEAM RED",
          value: formatTeam(teamB) || "メンバーなし",
          inline: true,
        }
      )
  );
};
