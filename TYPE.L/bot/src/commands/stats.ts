// ファイル先頭に型定義を追加
import { EmbedBuilder } from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { createErrorEmbed } from "../lib/embeds";

// チャンピオン統計情報の型定義
interface ChampionStats {
  champion_name: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

// ゲーム履歴の型定義
interface GameHistory {
  game_id: string;
  server_id: string;
  match_id: string;
  blue_team_win: number;
  played_at: number;
  game_duration: number;
}

export const statsCommand = {
  data: {
    name: "stats",
    description: "カスタムゲームの統計情報を表示",
    options: [
      {
        name: "player",
        description: "プレイヤーの統計を表示",
        type: 1,
        options: [
          {
            name: "user",
            description: "統計を表示するユーザー",
            type: 6, // USER型
            required: false,
          },
        ],
      },
      {
        name: "server",
        description: "サーバー全体の統計を表示",
        type: 1,
      },
      {
        name: "history",
        description: "最近のゲーム履歴を表示",
        type: 1,
        options: [
          {
            name: "count",
            description: "表示する試合数（1-10）",
            type: 4, // INTEGER型
            required: false,
          },
        ],
      },
    ],
  },

  execute: async (interaction: any) => {
    const serverId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply();

    try {
      // プレイヤー統計表示
      if (subcommand === "player") {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;
        const player = getPlayer(targetUser.id);

        if (!player) {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                targetUser.id === interaction.user.id
                  ? "あなたはまだ登録されていません。`/register`コマンドで登録してください。"
                  : "指定されたユーザーは登録されていません。"
              ),
            ],
          });
        }

        const stats = gameDB.getPlayerStats(serverId, targetUser.id);
        const topChampions = gameDB.getPlayerTopChampions(
          serverId,
          targetUser.id
        ) as ChampionStats[];

        const winRate =
          stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;

        const kda =
          stats.deaths > 0
            ? ((stats.kills + stats.assists) / stats.deaths).toFixed(2)
            : "Perfect";

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${player.riot_id}#${player.tagline}のカスタムゲーム統計`)
          .setThumbnail(
            `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/${player.profile_icon_id}.png`
          )
          .addFields(
            {
              name: "📊 サーバー内戦績",
              value: `${stats.games}試合 ${stats.wins}勝 ${
                stats.games - stats.wins
              }敗\n勝率: ${winRate}%`,
              inline: false,
            },
            {
              name: "⚔️ KDA統計",
              value: `KDA: ${kda}\nK/D/A: ${stats.kills}/${stats.deaths}/${stats.assists}`,
              inline: false,
            }
          );

        // チャンピオン情報がある場合
        if (topChampions.length > 0) {
          const championsStr = topChampions
            .map((champ: ChampionStats) => {
              const champWinRate = Math.round((champ.wins / champ.games) * 100);
              const champKDA =
                champ.deaths > 0
                  ? ((champ.kills + champ.assists) / champ.deaths).toFixed(2)
                  : "Perfect";

              return `${champ.champion_name}: ${champ.games}試合 ${champWinRate}%勝率 ${champKDA}KDA`;
            })
            .join("\n");

          embed.addFields({
            name: "🏆 よく使用するチャンピオン",
            value: championsStr || "データがありません",
            inline: false,
          });
        }
        return await interaction.editReply({ embeds: [embed] });
      }

      // サーバー全体の統計表示
      else if (subcommand === "server") {
        const stats = gameDB.getServerGameStats(serverId);

        const blueWinRate =
          stats.totalGames > 0
            ? Math.round((stats.blueWins / stats.totalGames) * 100)
            : 0;

        const redWinRate =
          stats.totalGames > 0
            ? Math.round((stats.redWins / stats.totalGames) * 100)
            : 0;

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${interaction.guild.name} のカスタムゲーム統計`)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .addFields(
            {
              name: "🎮 総ゲーム数",
              value: `${stats.totalGames}試合`,
              inline: false,
            },
            {
              name: "🔵 ブルーチーム勝率",
              value: `${stats.blueWins}勝 (${blueWinRate}%)`,
              inline: true,
            },
            {
              name: "🔴 レッドチーム勝率",
              value: `${stats.redWins}勝 (${redWinRate}%)`,
              inline: true,
            }
          );


        return await interaction.editReply({ embeds: [embed] });
      }

      // ゲーム履歴表示
      else if (subcommand === "history") {
        const count = Math.min(
          interaction.options.getInteger("count") || 5,
          10
        );

        const history = gameDB.getServerGameHistory(serverId, count);

        if (history.length === 0) {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed(
                "このサーバーでは、まだカスタムゲームの記録がありません。"
              ),
            ],
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`${interaction.guild.name} の最近のカスタムゲーム履歴`)
          .setDescription(`最近の${history.length}試合の結果`);

        for (const game of history as GameHistory[]) {
          const date = new Date(game.played_at * 1000).toLocaleString("ja-JP");
          const duration = Math.floor(game.game_duration / 60);
          const winner = game.blue_team_win
            ? "🔵 ブルーチーム"
            : "🔴 レッドチーム";

          embed.addFields({
            name: `${date} (${duration}分)`,
            value: `勝者: ${winner}\nゲームID: ${game.game_id}\nマッチID: ${game.match_id}`,
            inline: false,
          });
        }


        return await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("統計表示エラー:", error);
      return await interaction.editReply({
        embeds: [createErrorEmbed("統計情報の取得中にエラーが発生しました。")],
      });
    }
  },
};

export default statsCommand;
