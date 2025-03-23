import { EmbedBuilder, MessageFlags } from "discord.js";
import { getAllPlayers } from "../db";
import { gameDB } from "../db/gameDB";
import { BOT_DEVELOPER_ID } from "../lib/config";
import { addStandardFooter } from "../lib/embedHelper";
import {
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
} from "../lib/embeds";
import { formatGameTime } from "../lib/gameUtils";

// 開発者チェック関数
const isDeveloper = (userId: string) => userId === BOT_DEVELOPER_ID;

export const debugCommand = {
  data: {
    name: "debug",
    description: "開発者用デバッグ機能",
    options: [
      {
        name: "status",
        description: "システム状態の確認",
        type: 1,
      },
      {
        name: "game",
        description: "特定のゲームの詳細情報を表示",
        type: 1,
        options: [
          {
            name: "game_id",
            description: "ゲームID",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      // cleanupサブコマンドを削除
      {
        name: "forcekill",
        description: "追跡中のゲームを強制終了",
        type: 1,
        options: [
          {
            name: "game_id",
            description: "ゲームID",
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: "list",
        description: "アクティブなゲーム一覧を表示",
        type: 1,
      },
    ],
  },

  execute: async (interaction: any) => {
    // 開発者チェック（管理者チェックを削除）
    if (!isDeveloper(interaction.user.id)) {
      return interaction.reply({
        embeds: [createErrorEmbed("このコマンドは開発者のみが使用できます")],
        flags: MessageFlags.Ephemeral,
      });
    }

    // サブコマンド取得
    const subcommand = interaction.options.getSubcommand();

    // status サブコマンド
    if (subcommand === "status") {
      await interaction.deferReply();

      try {
        // システムステータスを取得
        const embed = await createStatusEmbed(interaction.client);
        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("ステータス取得エラー:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "システムステータスの取得中にエラーが発生しました"
            ),
          ],
        });
      }
    }

    // game サブコマンド
    if (subcommand === "game") {
      await interaction.deferReply();

      try {
        const gameId = interaction.options.getString("game_id");
        const game = gameDB.getGame(gameId);

        if (!game) {
          return await interaction.editReply({
            embeds: [createWarningEmbed(`ゲーム ${gameId} が見つかりません`)],
          });
        }

        // 参加者情報を取得
        const participants = gameDB.getParticipants(gameId);

        // サーバー名を取得
        let serverName = "不明なサーバー";
        try {
          const guild = await interaction.client.guilds.fetch(game.server_id);
          if (guild) {
            serverName = guild.name;
          }
        } catch (error) {
          console.warn(`サーバー${game.server_id}の情報取得に失敗:`, error);
        }

        // ゲーム詳細Embedを作成
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`🔍 ゲーム詳細: ${gameId}`)
          .addFields(
            { name: "ステータス", value: game.status || "不明", inline: true },
            {
              name: "チーム分け方法",
              value: game.balance_method || "不明",
              inline: true,
            },
            {
              name: "作成日時",
              value: new Date(game.created_at * 1000).toLocaleString("ja-JP"),
              inline: true,
            },
            {
              name: "サーバー",
              value: serverName,
              inline: true,
            },
            {
              name: "チャンネルID",
              value: `\`${game.channel_id}\``,
              inline: true,
            },
            {
              name: "メッセージID",
              value: `\`${game.message_id || "なし"}\``,
              inline: true,
            }
          );

        if (game.spectator_match_id) {
          embed.addFields(
            { name: "マッチID", value: game.spectator_match_id, inline: true },
            {
              name: "地域",
              value: game.spectator_region || "不明",
              inline: true,
            }
          );
        }

        // 参加者情報を追加
        if (participants.length > 0) {
          const teamA = participants.filter((p) => p.team === "A");
          const teamB = participants.filter((p) => p.team === "B");
          const noTeam = participants.filter((p) => !p.team);

          let participantsStr = "";
          if (teamA.length > 0) {
            participantsStr += "**チームA**\n";
            participantsStr += teamA
              .map((p) => `${p.riot_id}#${p.tagline} (${p.lane || "FILL"})`)
              .join("\n");
            participantsStr += "\n\n";
          }

          if (teamB.length > 0) {
            participantsStr += "**チームB**\n";
            participantsStr += teamB
              .map((p) => `${p.riot_id}#${p.tagline} (${p.lane || "FILL"})`)
              .join("\n");
            participantsStr += "\n\n";
          }

          if (noTeam.length > 0) {
            participantsStr += "**未割り当て**\n";
            participantsStr += noTeam
              .map((p) => `${p.riot_id}#${p.tagline} (${p.lane || "FILL"})`)
              .join("\n");
          }

          embed.addFields({
            name: `参加者 (${participants.length}人)`,
            value: participantsStr || "情報なし",
            inline: false,
          });
        } else {
          embed.addFields({
            name: "参加者",
            value: "参加者なし",
            inline: false,
          });
        }

        // 標準フッターを追加
        await addStandardFooter(embed, interaction.client);

        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("ゲーム情報取得エラー:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed("ゲーム情報の取得中にエラーが発生しました"),
          ],
        });
      }
    }

    // forcekill サブコマンド
    if (subcommand === "forcekill") {
      await interaction.deferReply();

      try {
        const gameId = interaction.options.getString("game_id");
        const game = gameDB.getGame(gameId);

        if (!game) {
          return await interaction.editReply({
            embeds: [createWarningEmbed(`ゲーム ${gameId} が見つかりません`)],
          });
        }

        if (game.status !== "TRACKING") {
          return await interaction.editReply({
            embeds: [
              createWarningEmbed(
                `ゲーム ${gameId} は追跡中ではありません (現在のステータス: ${game.status})`
              ),
            ],
          });
        }

        // ゲームステータスを強制的に完了に変更
        gameDB.updateGameStatus(gameId, "COMPLETED");

        return await interaction.editReply({
          embeds: [
            createSuccessEmbed(`ゲーム ${gameId} の追跡を強制終了しました`),
          ],
        });
      } catch (error) {
        console.error("強制終了エラー:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed("ゲームの強制終了中にエラーが発生しました"),
          ],
        });
      }
    }

    // list サブコマンド
    if (subcommand === "list") {
      await interaction.deferReply();

      try {
        // アクティブなゲーム一覧を取得
        const activeGames = await getActiveGames();

        if (activeGames.length === 0) {
          return await interaction.editReply({
            embeds: [createWarningEmbed("現在アクティブなゲームはありません")],
          });
        }

        // ゲーム一覧Embedを作成
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("🎮 アクティブゲーム一覧")
          .setDescription(`現在実行中のゲーム: ${activeGames.length}件`);

        // ゲーム情報を追加
        for (const game of activeGames) {
          const status = game.status === "TRACKING" ? "🔴 追跡中" : "🟢 募集中";
          const participants = gameDB.getParticipants(game.game_id).length;
          const createdAt = new Date(game.created_at * 1000).toLocaleString(
            "ja-JP"
          );

          // サーバー名を取得
          let serverName = "不明なサーバー";
          try {
            const guild = await interaction.client.guilds.fetch(game.server_id);
            if (guild) {
              serverName = guild.name;
            }
          } catch (error) {
            console.warn(`サーバー${game.server_id}の情報取得に失敗:`, error);
          }

          embed.addFields({
            name: `${status} - ${game.game_id}`,
            value: `サーバー: **${serverName}**\n作成: ${createdAt}\n参加者: ${participants}人\nチャンネル: <#${game.channel_id}>`,
            inline: true,
          });
        }

        // 標準フッターを追加
        await addStandardFooter(embed, interaction.client);

        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("ゲーム一覧取得エラー:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "アクティブゲーム一覧の取得中にエラーが発生しました"
            ),
          ],
        });
      }
    }

    // 未知のサブコマンド
    return interaction.reply({
      embeds: [createErrorEmbed("不明なサブコマンドです")],
      flags: MessageFlags.Ephemeral,
    });
  },
};

// システムステータスEmbedを作成
async function createStatusEmbed(client: any): Promise<EmbedBuilder> {
  // ボットステータス
  const uptime = formatGameTime(Math.floor(client.uptime / 1000));
  const serverCount = client.guilds.cache.size;
  const userCount = client.users.cache.size;

  // DB統計
  const playerCount = getAllPlayers().length;

  // アクティブゲーム
  const activeGames = await getActiveGames();
  const trackingGames = activeGames.filter(
    (g) => g.status === "TRACKING"
  ).length;
  const waitingGames = activeGames.filter((g) => g.status === "WAITING").length;

  // メモリ使用量
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB =
    Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100;

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("📊 システムステータス")
    .addFields(
      { name: "⏱️ 稼働時間", value: uptime, inline: true },
      { name: "🖥️ サーバー数", value: serverCount.toString(), inline: true },
      { name: "👥 ユーザー数", value: userCount.toString(), inline: true },
      {
        name: "👤 登録プレイヤー数",
        value: playerCount.toString(),
        inline: true,
      },
      { name: "🎮 募集中ゲーム", value: waitingGames.toString(), inline: true },
      {
        name: "🔴 追跡中ゲーム",
        value: trackingGames.toString(),
        inline: true,
      },
      { name: "💾 メモリ使用量", value: `${memoryUsageMB} MB`, inline: true },
      { name: "⚙️ Bun.js", value: Bun.version, inline: true },
      {
        name: "🔄 Discord.js",
        value: require("discord.js").version,
        inline: true,
      }
    );

  return await addStandardFooter(embed, client);
}

// アクティブなゲーム一覧を取得
async function getActiveGames(): Promise<any[]> {
  return gameDB.getActiveGames();
}

// cleanupOldGames関数も削除

export default debugCommand;
