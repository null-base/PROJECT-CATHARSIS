import { EmbedBuilder } from "discord.js";
import { getPlayer } from "../db";
import { RiotAPI } from "../lib/riotApi";
import { createErrorEmbed } from "../lib/embeds";
import { getProfileIconUrl } from "../lib/ddragon";

export const historyCommand = {
  data: {
    name: "history",
    description: "過去5試合の結果を表示",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      // プレイヤーデータの取得
      const player = getPlayer(interaction.user.id);
      if (!player) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "登録情報が見つかりません。`/register`で登録してください。"
            ),
          ],
          ephemeral: true,
        });
      }

      // 最新のゲーム名とタグラインを取得
      const accountData = await RiotAPI.getGamenameTagline(player.puuid);

      // プロフィールアイコンを取得
      const iconUrl = await getProfileIconUrl(player.profile_icon_id);

      // 試合履歴を取得
      const matchIds = await RiotAPI.getMatchHistory(player.puuid, player.region);

      // 最新5試合に絞る
      const recentMatchIds = matchIds.slice(0, 5);

      // 試合詳細をすべて取得
      const matches = await Promise.all(
        recentMatchIds.map((id: string) =>
          RiotAPI.getMatchDetails(id, player.region)
        )
      );

      // 結果をEmbedに表示する
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${accountData.gameName}#${accountData.tagLine} の最近の試合`)
        .setThumbnail(iconUrl)
        .setDescription("直近5試合の結果")
        .setFooter({
          text: "Powered by @null_sensei • null-base.com",
          iconURL: "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
        });

      let winCount = 0;
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;

      // 各試合の詳細を追加
      matches.forEach((match: any) => {
        const participant = match.info.participants.find(
          (p: any) => p.puuid === player.puuid
        );

        if (!participant) return;

        const win = participant.win;
        const champion = participant.championName;
        const kills = participant.kills;
        const deaths = participant.deaths;
        const assists = participant.assists;
        const kda = deaths === 0 ? "Perfect" : ((kills + assists) / deaths).toFixed(2);
        const cs = participant.totalMinionsKilled + participant.neutralMinionsKilled;
        let lane = participant.lane;
        if (lane === "BOTTOM" && participant.role.includes("SUPPORT")) {
          lane = "SUPPORT";
        }
        const gameMode = match.info.gameMode;
        const gameDuration = Math.floor(match.info.gameDuration / 60);

        if (win) winCount++;
        totalKills += kills;
        totalDeaths += deaths;
        totalAssists += assists;

        const emoji = win ? "✅" : "❌";
        const matchTime = new Date(match.info.gameCreation).toLocaleDateString();

        embed.addFields({
          name: `${emoji} ${champion} [${lane}] - ${matchTime}`,
          value: `${gameMode} (${gameDuration}分)\n${kills}/${deaths}/${assists} (KDA: ${kda}) CS: ${cs}`,
          inline: false
        });
      });

      const totalGames = matches.length;
      const winRate = totalGames > 0 ? (winCount / totalGames * 100).toFixed(1) : "0.0";
      const avgKda = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "Perfect";

      // 統計サマリーを先頭に追加
      embed.spliceFields(0, 0, {
        name: "📊 サマリー",
        value: `${totalGames}試合 ${winCount}勝 ${totalGames - winCount}敗\n勝率: ${winRate}%\n平均KDA: ${avgKda} (${totalKills}/${totalDeaths}/${totalAssists})`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("試合履歴取得エラー:", error);
      await interaction.editReply({
        embeds: [createErrorEmbed("試合履歴の取得に失敗しました")],
        ephemeral: true,
      });
    }
  },
};

export default historyCommand;
