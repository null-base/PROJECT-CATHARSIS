import { createNewCustomGame } from "../components/customGame";
import { createErrorEmbed, createSuccessEmbed } from "../lib/embeds";

export const balanceCommand = {
  data: {
    name: "balance",
    description: "カスタムゲームの参加管理とチーム分け",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      // 共通関数を使用してカスタムゲームを作成
      const gameId = await createNewCustomGame(
        interaction.client,
        interaction.channelId
      );

      if (gameId) {
        await interaction.editReply({
          embeds: [createSuccessEmbed("カスタムゲームを作成しました！")],
        });
      } else {
        await interaction.editReply({
          embeds: [
            createErrorEmbed("カスタムゲーム作成中にエラーが発生しました"),
          ],
        });
      }
    } catch (error) {
      console.error("バランシングエラー:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed("カスタムゲーム処理中にエラーが発生しました"),
        ],
      });
    }
  },
};

export default balanceCommand;
