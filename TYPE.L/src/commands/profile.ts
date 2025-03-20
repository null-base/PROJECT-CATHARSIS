import { EmbedBuilder } from "discord.js";
import { getPlayer, savePlayer } from "../db";
import { processMatchStats } from "../lib/calculations";
import { getProfileIconUrl } from "../lib/ddragon";
import { createErrorEmbed, createProfileEmbed } from "../lib/embeds";
import { RiotAPI } from "../lib/riotApi";
import type { PlayerData } from "../types/types";

export const profileCommand = {
  data: {
    name: "profile",
    description: "プロフィールを表示",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      // プレイヤーデータの取得
      let player = getPlayer(interaction.user.id);
      if (!player) {
        const registerEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("⚠️ 未登録ユーザー")
          .setDescription("プロフィールを表示するには登録が必要です")
          .setFooter({
            text: "Power by @null_sensei • null-base.com",
            iconURL:
              "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
          })
          .addFields({
            name: "登録方法",
            value: "`/register` コマンドで登録してください",
            inline: true,
          });
        return interaction.editReply({
          embeds: [registerEmbed],
        });
      }

      // 最新のゲーム名とタグラインを取得
      const accountData = await RiotAPI.getGamenameTagline(player.puuid);

      // 最新のサモナー情報を取得
      const summonerData = await RiotAPI.getSummonerData(
        player.region,
        player.puuid
      );
      const rankData = await RiotAPI.getRankData(player.region, player.puuid);

      // データベースの更新
      const soloRank = rankData.find(
        (d: any) => d.queueType === "RANKED_SOLO_5x5"
      );
      const flexRank = rankData.find(
        (d: any) => d.queueType === "RANKED_FLEX_SR"
      );

      const updatedPlayer: PlayerData = {
        ...player,
        riot_id: accountData.gameName,
        tagline: accountData.tagLine,
        level: summonerData.summonerLevel,
        profile_icon_id: summonerData.profileIconId,
        solo_tier: soloRank?.tier || "UNRANKED",
        solo_division: soloRank?.rank || "",
        solo_lp: soloRank?.leaguePoints || 0,
        flex_tier: flexRank?.tier || "UNRANKED",
        flex_division: flexRank?.rank || "",
        flex_lp: flexRank?.leaguePoints || 0,
      };

      savePlayer(updatedPlayer);
      player = updatedPlayer;

      const iconUrl = await getProfileIconUrl(player.profile_icon_id);

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
      })
        .setThumbnail(iconUrl)
        .setFooter({
          text: "Power by @null_sensei • null-base.com",
          iconURL:
            "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("プロフィール取得エラー:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("プロフィールの取得に失敗しました")],
        ephemeral: true,
      });
    }
  },
};

export default profileCommand;
