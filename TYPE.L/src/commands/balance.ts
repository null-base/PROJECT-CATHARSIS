import { MessageFlags } from "discord.js";
import { getAllPlayers } from "../db";
import { calculateStrength } from "../lib/calculations";
import { createBalanceEmbed, createErrorEmbed } from "../lib/embeds";

export const balanceCommand = {
  data: {
    name: "balance",
    description: "バランスチームを作成",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const players = getAllPlayers();
      if (players.length < 2) throw new Error("最低2人のプレイヤーが必要です");

      // ソロランクとフレックスランクの平均値を計算してソート
      const sortedPlayers = [...players].sort((a, b) => {
        const aStrength =
          (calculateStrength(a.solo_tier, a.solo_division, a.solo_lp) +
            calculateStrength(a.flex_tier, a.flex_division, a.flex_lp)) /
          2;

        const bStrength =
          (calculateStrength(b.solo_tier, b.solo_division, b.solo_lp) +
            calculateStrength(b.flex_tier, b.flex_division, b.flex_lp)) /
          2;

        return bStrength - aStrength;
      });

      let teamA: any[] = [];
      let teamB: any[] = [];
      let totalA = 0;
      let totalB = 0;

      for (const player of sortedPlayers) {
        // ソロとフレックスの平均値を強さとして使用
        const strength =
          (calculateStrength(
            player.solo_tier,
            player.solo_division,
            player.solo_lp
          ) +
            calculateStrength(
              player.flex_tier,
              player.flex_division,
              player.flex_lp
            )) /
          2;

        if (totalA <= totalB) {
          teamA.push(player);
          totalA += strength;
        } else {
          teamB.push(player);
          totalB += strength;
        }
      }

      await interaction.editReply({
        embeds: [createBalanceEmbed(teamA, teamB, totalA, totalB)],
      });
    } catch (error) {
      console.error("バランシングエラー:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("チーム分けに失敗しました")],
        ephemeral: true,
      });
    }
  },
};

export default balanceCommand;
