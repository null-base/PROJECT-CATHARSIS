import { MessageFlags } from "discord.js";
import { gameDB } from "../db/gameDB";
import {
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
} from "../lib/embeds";
import { displayGameResult, handleShowResult } from "../services/resultService";
import { startTrackingGame } from "../services/trackingService";
import { createNewCustomGame } from "./gameCreation";

// ゲーム追跡処理
export const handleTrackGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // 参加者情報を取得
    const participants = gameDB.getParticipants(gameId);

    if (participants.length === 0) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("このゲームには参加者がいません。")],
      });
    }

    // 追跡開始
    const result = await startTrackingGame(interaction, gameId, participants);

    if (!result.success) {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(result.message ?? "不明なエラーが発生しました。"),
        ],
      });
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `ゲームの追跡を開始しました。\n試合情報を表示しています。`
        ),
      ],
    });
  } catch (error) {
    console.error("[handleTrackGame] ゲーム追跡エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("ゲーム追跡の開始中にエラーが発生しました。")],
    });
  }
};

// 追跡終了ハンドラー
export const handleEndTracking = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const game = gameDB.getGame(gameId);
    if (!game) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // チャンネルIDを保存
    const channelId = game.channel_id;

    // ゲームステータスを完了に更新
    gameDB.updateGameStatus(gameId, "COMPLETED");

    try {
      await updateEndTrackingMessage(interaction, game);

      // 新しいカスタムゲームを作成
      await createNewCustomGame(interaction.client, channelId);

      await interaction.editReply({
        embeds: [
          createSuccessEmbed(
            `ゲーム追跡を終了しました。新しいカスタムゲームが作成されました！`
          ),
        ],
      });
    } catch (error) {
      console.error("メッセージ更新エラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed("メッセージの更新中にエラーが発生しました。"),
        ],
      });
    }
  } catch (error) {
    console.error("追跡終了エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("追跡終了処理中にエラーが発生しました。")],
    });
  }
};

// 終了メッセージの更新
async function updateEndTrackingMessage(interaction: any, game: any) {
  const { ChannelType, EmbedBuilder } = await import("discord.js");

  const channel = await interaction.client.channels.fetch(game.channel_id);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const message = await channel.messages.fetch(game.message_id);
  if (!message) return;

  // 試合終了メッセージに更新
  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle("🛑 追跡終了")
    .setDescription(`ゲームID: ${game.id}\n試合追跡は手動で終了されました。`);

  await message.edit({
    embeds: [embed],
    components: [],
  });
}

export { displayGameResult, handleShowResult };
