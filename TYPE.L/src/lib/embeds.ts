import { EmbedBuilder } from "discord.js";
import type { PlayerData } from "../types/types";
import { calculateStrength } from "./calculations";

export const createRegisterEmbed = (player: PlayerData) => {
  const soloStrength = calculateStrength(
    player.solo_tier,
    player.solo_division,
    player.solo_lp
  );
  const flexStrength = calculateStrength(
    player.flex_tier,
    player.flex_division,
    player.flex_lp
  );
  const averageStrength = (soloStrength + flexStrength) / 2;

  return new EmbedBuilder()
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
      },
      {
        name: "💪 推定強さ",
        value: `${averageStrength.toFixed(1)} (Solo: ${soloStrength.toFixed(
          1
        )}, Flex: ${flexStrength.toFixed(1)})`,
        inline: true,
      }
    )
    .setColor(0x00ff00);
};

export const createProfileEmbed = (player: PlayerData, stats: any) => {
  const laneStats = stats.topLanes
    .map((lane: string) => `• ${lane}`)
    .join("\n");

  return new EmbedBuilder()
    .setTitle(`${player.riot_id}#${player.tagline}`)
    .setColor(0x00ff00)
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
    );
};

export const createBalanceEmbed = (
  teamA: any[],
  teamB: any[],
  totalA: number,
  totalB: number
) => {
  return new EmbedBuilder()
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
      },
      {
        name: "強さ合計",
        value: `🟢 Team A: ${totalA.toFixed(1)}\n🔴 Team B: ${totalB.toFixed(
          1
        )}\n📊 差: ${Math.abs(totalA - totalB).toFixed(1)}`,
        inline: false,
      }
    );
};

export const createErrorEmbed = (message: string) => {
  return new EmbedBuilder().setColor(0xff0000).setDescription(`❌ ${message}`);
};
