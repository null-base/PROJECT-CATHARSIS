import { ChannelType, EmbedBuilder } from "discord.js";
import { gameDB } from "../db/gameDB";
import { addStandardFooter } from "../lib/embedHelper";
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from "../lib/embeds";
import { createNewCustomGame } from "./gameCreation";

// ゲーム終了処理
export const handleEndGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply();

  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // チャンネルIDを保存（後でカスタムゲーム作成に使用）
    const channelId = game.channel_id;

    // ゲームのステータスを終了に更新
    gameDB.updateGameStatus(gameId, "COMPLETED");

    // 参加者を取得
    const participants = gameDB.getParticipants(gameId);

    // 終了メッセージ作成
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("🏁 カスタムゲーム終了")
      .setDescription(`ゲームID: ${gameId}`)
      .addFields({
        name: "参加者",
        value:
          participants.length > 0
            ? participants.map((p) => `${p.riot_id}#${p.tagline}`).join("\n")
            : "参加者なし",
        inline: false,
      });

    // 標準フッターを追加
    await addStandardFooter(embed, interaction.client);

    // 元のメッセージを更新
    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        const message = await channel.messages.fetch(game.message_id);
        if (message) {
          // コンポーネントを削除してゲーム終了状態に
          await message.edit({
            embeds: [embed],
            components: [],
          });
        }
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(`カスタムゲームを終了しました。`)],
      });
    } catch (error) {
      console.error("メッセージ更新エラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "メッセージ更新中にエラーが発生しましたが、ゲームは終了しました。"
          ),
        ],
      });
    }
  } catch (error) {
    console.error("ゲーム終了エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("ゲーム終了処理中にエラーが発生しました。")],
    });
  }
};
