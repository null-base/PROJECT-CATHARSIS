import { ChannelType } from "discord.js";
import { gameDB } from "../db/gameDB";
import { createCustomGameEmbed } from "../lib/embeds";

/**
 * カスタムゲームのメッセージとEmbedを更新する
 */
export async function updateGameEmbed(
  interaction: any,
  gameId: string
): Promise<boolean> {
  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) return false;

    // 参加者を取得
    const participants = gameDB.getParticipants(gameId);

    // チャンネルとメッセージを取得
    const channel = await interaction.client.channels.fetch(game.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) return false;

    const message = await channel.messages.fetch(game.message_id);
    if (!message) return false;

    // ゲームがトラッキング中の場合は更新しない (トラッキングUIを優先)
    if (game.status === "TRACKING") {
      console.log(
        `[updateGameEmbed] ゲーム ${gameId} はトラッキング中のため更新をスキップします`
      );
      return true;
    }

    // Embedを更新 (WAITING または COMPLETED 状態)
    const embed = createCustomGameEmbed(
      gameId,
      participants,
      game.balance_method
    );
    await message.edit({ embeds: [embed] });

    return true;
  } catch (error) {
    console.error("Embed更新エラー:", error);
    return false;
  }
}
