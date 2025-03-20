import { InteractionType } from "discord.js";
import {
  balanceCommand,
  pingCommand,
  profileCommand,
  registerCommand,
  unregisterCommand,
} from "../commands";
import { createErrorEmbed } from "../lib/embeds";

const commands = {
  balance: balanceCommand,
  profile: profileCommand,
  register: registerCommand,
  unregister: unregisterCommand,
  ping: pingCommand,
};

export const interactionCreate = async (interaction: any) => {
  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === "registerModal") {
      return registerCommand.handleModalSubmit(interaction);
    }
    return;
  }

  if (!interaction.isCommand()) return;

  const command = commands[interaction.commandName as keyof typeof commands];

  if (!command) {
    return interaction.reply({
      embeds: [createErrorEmbed("不明なコマンドです")],
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      embeds: [createErrorEmbed("コマンドの実行中にエラーが発生しました")],
      ephemeral: true,
    });
  }
};
