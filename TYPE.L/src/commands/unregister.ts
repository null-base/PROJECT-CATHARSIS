import { MessageFlags } from "discord.js";
import { deletePlayer } from "../db";
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
      if (result.changes === 0) throw new Error("登録情報が見つかりません");

      await interaction.editReply({
        content: "✅ 登録情報を削除しました",
        ephemeral: true,
      });
    } catch (error) {
      console.log(error);

      await interaction.editReply({
        embeds: [createErrorEmbed("登録解除に失敗しました")],
        ephemeral: true,
      });
    }
  },
};

export default unregisterCommand;
