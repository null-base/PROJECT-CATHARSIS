import { InteractionType } from "discord.js";
import {
  balanceCommand,
  historyCommand,
  pingCommand,
  profileCommand,
  registerCommand,
  unregisterCommand,
} from "../commands";
import {
  handleEndGame,
  handleJoinGame,
  handleLaneSelect,
  handleLeaveGame,
  handleTeamBalance,
  handleTrackGame,
  handleVoiceJoin,
} from "../components/customGame";
import { createErrorEmbed } from "../lib/embeds";

const commands = {
  balance: balanceCommand,
  profile: profileCommand,
  register: registerCommand,
  unregister: unregisterCommand,
  ping: pingCommand,
  history: historyCommand,
};

export const interactionCreate = async (interaction: any) => {
  // モーダル送信処理
  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === "registerModal") {
      return registerCommand.handleModalSubmit(interaction);
    }
    return;
  }

  // カスタムゲームコンポーネントのハンドリング
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    // フォーマットは "action_gameId"
    const customIdParts = interaction.customId.split("_");

    if (customIdParts.length >= 2) {
      const action = customIdParts[0];
      const gameId = customIdParts.slice(1).join("_"); // アンダースコアが含まれるIDにも対応

      // カスタムゲーム用インタラクション処理
      if (action === "join") {
        return await handleJoinGame(interaction, gameId);
      }

      if (action === "leave") {
        return await handleLeaveGame(interaction, gameId);
      }

      if (action === "voice") {
        return await handleVoiceJoin(interaction, gameId);
      }

      if (action === "balance") {
        return await handleTeamBalance(interaction, gameId);
      }

      if (action === "track") {
        return await handleTrackGame(interaction, gameId);
      }

      if (action === "lane") {
        return await handleLaneSelect(interaction, gameId);
      }

      if (action === "end") {
        return await handleEndGame(interaction, gameId);
      }
    }
  }

  // 通常のコマンド処理
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
