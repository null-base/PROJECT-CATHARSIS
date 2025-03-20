import { EmbedBuilder, MessageFlags } from "discord.js";
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

      if (result.changes === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed("登録情報が見つかりません")],
          ephemeral: true,
        });
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setAuthor({
          name: "✅ アカウント削除完了",
        })
        .setDescription("登録情報を正常に削除しました")
        .setFooter({
          text: "Power by @null_sensei • null-base.com",
          iconURL:
            "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
        });

      await interaction.editReply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("登録解除エラー:", error);

      const errorEmbed = createErrorEmbed(
        "⚠️ 登録解除処理中にエラーが発生しました"
      );

      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};

export default unregisterCommand;
