import { EmbedBuilder } from "discord.js";
import type { PlayerData } from "../types/types";
import { calculateStrength } from "./calculations";

export const createRegisterEmbed = (player: PlayerData) => {
  const soloStrength = calculateStrength(
    player.solo_tier || "UNRANKED",
    player.solo_division || "",
    player.solo_lp || 0,
    player.level
  );
  const flexStrength = calculateStrength(
    player.flex_tier || "UNRANKED",
    player.flex_division || "",
    player.flex_lp || 0,
    player.level
  );
  const averageStrength = (soloStrength + flexStrength) / 2 || 0;

  return new EmbedBuilder()
    .setTitle("✅ 登録完了")
    .setDescription(`${player.riot_id}#${player.tagline}`)
    .setFooter({
      text: "Power by @null_sensei • null-base.com",
      iconURL:
        "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
    })
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
  const soloStrength = calculateStrength(
    player.solo_tier || "UNRANKED",
    player.solo_division || "",
    player.solo_lp || 0,
    player.level
  );

  const flexStrength = calculateStrength(
    player.flex_tier || "UNRANKED",
    player.flex_division || "",
    player.flex_lp || 0,
    player.level
  );

  const averageStrength = (soloStrength + flexStrength) / 2 || 0;
  const laneStats = stats.topLanes
    .map((lane: string) => `• ${lane}`)
    .join("\n");

  return new EmbedBuilder()
    .setTitle(`${player.riot_id}#${player.tagline}`)
    .setColor(averageStrength > 2500 ? 0x0099ff : 0x00ff00) // 強さに応じて色変更
    .setFooter({
      text: "Power by @null_sensei • null-base.com",
      iconURL:
        "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
    })
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
      },
      {
        name: "💪 推定強さ",
        value:
          `平均: ${averageStrength.toFixed(1)}\n` +
          `ソロ: ${soloStrength.toFixed(1)}\n` +
          `フレックス: ${flexStrength.toFixed(1)}`,
        inline: false,
      },
      {
        name: "📈 レベル補正",
        value: `現在レベル: ${player.level}\n補正倍率: ×${(
          1 +
          Math.min(player.level * 5, 300) / 1000
        ).toFixed(2)}`,
        inline: true,
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
    .setFooter({
      text: "Power by @null_sensei • null-base.com",
      iconURL:
        "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
    })
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
