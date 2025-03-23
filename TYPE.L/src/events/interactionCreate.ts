import { InteractionType, MessageFlags } from "discord.js";
import {
  aboutCommand,
  balanceCommand,
  debugCommand, // debugCommandを追加
  historyCommand,
  profileCommand,
  registerCommand,
  unregisterCommand,
} from "../commands";
import {
  createNewCustomGame, // createNewCustomGameを追加
  handleBalanceMethodSelect,
  handleEndGame,
  handleEndTracking,
  handleJoinGame,
  handleLaneSelect,
  handleLeaveGame,
  handleShowResult,
  handleTeamBalance,
  handleTrackGame,
  handleVoiceJoin,
} from "../components/customGame";
import { createErrorEmbed, createSuccessEmbed } from "../lib/embeds"; // createSuccessEmbedを追加

const commands = {
  about: aboutCommand,
  balance: balanceCommand,
  debug: debugCommand, // 追加
  profile: profileCommand,
  register: registerCommand,
  unregister: unregisterCommand,
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

    // balancemethod_GAME_IDの形式を処理
    if (interaction.customId.startsWith("balancemethod_")) {
      const gameId = interaction.customId.replace("balancemethod_", "");
      return await handleBalanceMethodSelect(interaction, gameId);
    }

    if (interaction.customId.startsWith("endtrack_")) {
      const gameId = interaction.customId.replace("endtrack_", "");
      return await handleEndTracking(interaction, gameId);
    }

    if (interaction.customId.startsWith("result_")) {
      const gameId = interaction.customId.replace("result_", "");
      return await handleShowResult(interaction, gameId);
    }

    if (interaction.customId.startsWith("newgame_")) {
      const channelId = interaction.customId.replace("newgame_", "");
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gameId = await createNewCustomGame(interaction.client, channelId);

        if (gameId) {
          return await interaction.editReply({
            embeds: [
              createSuccessEmbed("新しいカスタムゲームを作成しました！"),
            ],
          });
        } else {
          return await interaction.editReply({
            embeds: [
              createErrorEmbed("カスタムゲーム作成中にエラーが発生しました"),
            ],
          });
        }
      } catch (error) {
        console.error("新規ゲーム作成エラー:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed("カスタムゲーム作成中にエラーが発生しました"),
          ],
        });
      }
    }
  }

  // ボタンハンドリング
  if (interaction.isButton()) {
    // game_<action>_<id> 形式のIDを処理
    if (interaction.customId.includes("_")) {
      const [prefix, action, ...idParts] = interaction.customId.split("_");
      if (prefix !== "game") return;

      // idPartsを結合してゲームIDを復元
      const gameId = idParts.join("_");

      // 以下は同じ
    }
  }

  // 通常のコマンド処理
  if (!interaction.isCommand()) return;

  const command = commands[interaction.commandName as keyof typeof commands];

  if (!command) {
    return interaction.reply({
      embeds: [createErrorEmbed("不明なコマンドです")],
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      embeds: [createErrorEmbed("コマンドの実行中にエラーが発生しました")],
      flags: MessageFlags.Ephemeral,
    });
  }
};
