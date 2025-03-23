import { MessageFlags } from "discord.js";
import { deletePlayer } from "../db";
import { createStandardEmbed } from "../lib/embedHelper";
import { createErrorEmbed } from "../lib/embeds";

export const unregisterCommand = {
  data: {
    name: "unregister",
    description: "登録情報を削除",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = deletePlayer(interaction.user.id);

      if (result.changes === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed("登録情報が見つかりません")],
          flags: MessageFlags.Ephemeral,
        });
      }

      // 統一された方法でEmbed作成
      const successEmbed = await createStandardEmbed(
        interaction.client,
        0x00ff00
      );
      successEmbed
        .setTitle("✅ アカウント削除完了")
        .setDescription("登録情報を正常に削除しました");

      await interaction.editReply({
        embeds: [successEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("登録解除エラー:", error);

      const errorEmbed = createErrorEmbed(
        "⚠️ 登録解除処理中にエラーが発生しました"
      );

      await interaction.editReply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default unregisterCommand;
