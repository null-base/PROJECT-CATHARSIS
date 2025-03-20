import { getPlayer } from "../db";
import { processMatchStats } from "../lib/calculations";
import { createErrorEmbed, createProfileEmbed } from "../lib/embeds";
import { RiotAPI } from "../lib/riotApi";

export const profileCommand = {
  data: {
    name: "profile",
    description: "プロフィールを表示",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      const player = getPlayer(interaction.user.id);
      if (!player) throw new Error("登録されていません");

      const matchIds = await RiotAPI.getMatchHistory(
        player.puuid,
        player.region
      );
      const matches = await Promise.all(
        matchIds.map((id: string) => RiotAPI.getMatchDetails(id, player.region))
      );

      const stats = processMatchStats(matches, player.puuid);
      const winRate = (
        (stats.total.wins / stats.total.games) * 100 || 0
      ).toFixed(1);
      const kda = (
        (stats.total.kills + stats.total.assists) /
        Math.max(stats.total.deaths, 1)
      ).toFixed(2);

      const topChampions = Array.from(stats.champions.entries())
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 3)
        .map(([name, data]) => {
          const wr = ((data.wins / data.games) * 100 || 0).toFixed(1);
          return `${name}: ${data.games}戦 ${wr}% WR`;
        });

      const topLanes = Array.from(stats.lanes.entries())
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 3)
        .map(([lane, data]) => {
          const wr = ((data.wins / data.games) * 100 || 0).toFixed(1);
          const kda = (
            (data.kills + data.assists) /
            Math.max(data.deaths, 1)
          ).toFixed(2);
          return `${lane}: ${data.games}戦 ${wr}% WR (${kda} KDA)`;
        });

      const embed = createProfileEmbed(player, {
        total: {
          games: stats.total.games,
          winRate,
          kda,
        },
        topChampions,
        topLanes,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.log(error);
      await interaction.editReply({
        embeds: [createErrorEmbed("プロフィールの取得に失敗しました")],
        ephemeral: true,
      });
    }
  },
};

export default profileCommand;
