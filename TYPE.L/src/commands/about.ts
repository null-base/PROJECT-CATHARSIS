import { EmbedBuilder } from "discord.js";
import {
  BOT_DEVELOPER_ID,
  BOT_DEVELOPER_NAME,
  BOT_GITHUB,
  BOT_SUPPORT_SERVER,
  BOT_VERSION,
  BOT_WEBSITE,
} from "../lib/config";
import { addStandardFooter } from "../lib/embedHelper";

export const aboutCommand = {
  data: {
    name: "about",
    description: "BOTについての詳細情報を表示します",
  },

  execute: async (interaction: any) => {
    await interaction.deferReply();

    try {
      // 統計情報を収集
      const guilds = interaction.client.guilds.cache.size;
      const users = interaction.client.guilds.cache.reduce(
        (acc: any, guild: { memberCount: any }) => acc + guild.memberCount,
        0
      );

      const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle("<:typel:1351994799112327260> PROJECT-CATHARSIS")
        .setDescription(
          "TYPE.Lは、League of Legendsのカスタムゲーム管理を支援するための多機能Botです。\n" +
            "チーム分けやプレイヤー情報の管理、戦績確認などの機能を提供します。"
        )
        .setThumbnail(
          interaction.client.user.displayAvatarURL({ dynamic: true, size: 512 })
        )
        .addFields(
          {
            name: "🛠️ バージョン",
            value: `v${BOT_VERSION}`,
            inline: true,
          },
          {
            name: "📊 統計情報",
            value: `サーバー数: ${guilds}\nユーザー数: ${users}`,
            inline: true,
          },
          {
            name: "👨‍💻 開発者",
            value:
              `[${BOT_DEVELOPER_NAME}(X)](https://twitter.com/null_x0o0x)\n` +
              `[${BOT_DEVELOPER_NAME}(Discord)](https://discordapp.com/users/${BOT_DEVELOPER_ID})`,
            inline: true,
          },
          {
            name: "🔗 リンク",
            value:
              `[サポートサーバー](${BOT_SUPPORT_SERVER})\n` +
              `[GitHub](${BOT_GITHUB})\n` +
              `[ウェブサイト](https://${BOT_WEBSITE})`,
            inline: true,
          }
        );

      // 標準フッターを追加
      await addStandardFooter(embed, interaction.client);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Aboutコマンドエラー:", error);

      // エラー時は簡易Embedを表示
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("エラーが発生しました")
        .setDescription(
          "情報の取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

export default aboutCommand;
