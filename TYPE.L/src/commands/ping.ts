import { EmbedBuilder } from "discord.js";
import { createErrorEmbed } from "../lib/embeds";
import { addStandardFooter } from "../lib/embedHelper";

export const pingCommand = {
  data: {
    name: "ping",
    description: "Pingをチェック",
  },

  execute: async (interaction: any) => {
    try {
      const start = Date.now();
      const latency = interaction.client.ws.ping;
      const apiLatency = Date.now() - start;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🏓 Pong!")
        .addFields(
          { name: "📡 WebSocket Ping", value: `${latency}ms`, inline: true },
          { name: "⚡ API Latency", value: `${apiLatency}ms`, inline: true }
        );
      // 標準フッターを追加
      await addStandardFooter(embed, interaction.client);

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      await interaction.reply({
        embeds: [createErrorEmbed("Pingの取得に失敗しました")],
      });
    }
  },
};

export default pingCommand;
