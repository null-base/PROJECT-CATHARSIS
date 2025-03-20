import { EmbedBuilder, MessageFlags } from "discord.js";
import { createErrorEmbed } from "../lib/embeds";

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

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        embeds: [createErrorEmbed("Pingの取得に失敗しました")],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default pingCommand;
