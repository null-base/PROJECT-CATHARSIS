import { MessageFlags } from "discord.js";
import { updateGameEmbed } from "../components/gameUI";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import {
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
} from "../lib/embeds";

// カスタムゲームへの参加処理
export const handleJoinGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      // エラー処理
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // ゲームが追跡中の場合は操作を制限
    if (game.status === "TRACKING" || game.status === "COMPLETED") {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "このゲームは既に開始されているか終了しています。参加・変更はできません。"
          ),
        ],
      });
    }

    // プレイヤー情報を取得
    const player = getPlayer(interaction.user.id);
    if (!player) {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "参加するには `/register` コマンドで登録が必要です。"
          ),
        ],
      });
    }

    // 参加状況を確認
    const isAlreadyJoined = gameDB.isParticipant(gameId, interaction.user.id);
    if (isAlreadyJoined) {
      return await interaction.editReply({
        embeds: [createSuccessEmbed("あなたはすでに参加登録済みです。")],
      });
    }

    // 参加者として登録
    gameDB.addParticipant(
      gameId,
      interaction.user.id,
      player.puuid,
      player.riot_id,
      player.tagline,
    );

    await updateGameEmbed(interaction, gameId);
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          "カスタムゲームに参加しました！\n希望レーンを選択してください。"
        ),
      ],
    });
  } catch (error) {
    console.error("参加エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("参加処理中にエラーが発生しました。")],
    });
  }
};

// レーン選択処理
export const handleLaneSelect = async (interaction: any, gameId: string) => {
  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      // エラー処理
      return await interaction.reply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ゲームが追跡中の場合は操作を制限
    if (game.status === "TRACKING" || game.status === "COMPLETED") {
      return await interaction.reply({
        embeds: [
          createWarningEmbed(
            "このゲームは既に開始されているか終了しています。参加・変更はできません。"
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const lane = interaction.values[0];

    // 参加者データを更新
    const success = gameDB.updateParticipantLane(
      gameId,
      interaction.user.id,
      lane
    );

    if (!success) {
      return await interaction.reply({
        embeds: [
          createWarningEmbed(
            "参加登録が必要です。まず参加ボタンを押してください。"
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await updateGameEmbed(interaction, gameId);
    await interaction.reply({
      embeds: [createSuccessEmbed(`レーンを **${lane}** に設定しました。`)],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("レーン選択エラー:", error);
    await interaction.reply({
      embeds: [createErrorEmbed("レーン選択中にエラーが発生しました。")],
      flags: MessageFlags.Ephemeral,
    });
  }
};

// カスタムゲームからの退出処理
export const handleLeaveGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      // エラー処理
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // ゲームが追跡中の場合は操作を制限
    if (game.status === "TRACKING" || game.status === "COMPLETED") {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "このゲームは既に開始されているか終了しています。参加・変更はできません。"
          ),
        ],
      });
    }

    const success = gameDB.removeParticipant(gameId, interaction.user.id);
    if (!success) {
      return await interaction.editReply({
        embeds: [createWarningEmbed("あなたは参加していません。")],
      });
    }

    await updateGameEmbed(interaction, gameId);
    await interaction.editReply({
      embeds: [createSuccessEmbed("カスタムゲームから退出しました。")],
    });
  } catch (error) {
    console.error("退出エラー:", error);
    await interaction.editReply({
      embeds: [createErrorEmbed("退出処理中にエラーが発生しました。")],
    });
  }
};

// VC参加者一括追加処理
export const handleVoiceJoin = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      // エラー処理
      return await interaction.editReply({
        embeds: [createWarningEmbed("ゲームが見つかりません。")],
      });
    }

    // ゲームが追跡中の場合は操作を制限
    if (game.status === "TRACKING" || game.status === "COMPLETED") {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "このゲームは既に開始されているか終了しています。参加・変更はできません。"
          ),
        ],
      });
    }

    // ユーザーがVCに参加しているか確認
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!member.voice?.channel) {
      return await interaction.editReply({
        embeds: [
          createWarningEmbed(
            "ボイスチャンネルに参加していないか、ボイス情報を取得できません。"
          ),
        ],
      });
    }

    const voiceChannel = member.voice.channel;

    // VC参加者を取得
    const voiceMembers = voiceChannel.members;
    let addedCount = 0;

    for (const [memberId, guildMember] of voiceMembers) {
      if (guildMember.user.bot) continue;

      const player = getPlayer(memberId);
      if (!player) continue;

      // 既に参加しているか確認
      const isAlreadyJoined = gameDB.isParticipant(gameId, memberId);
      if (isAlreadyJoined) continue;

      // 参加者として登録
      gameDB.addParticipant(
        gameId,
        memberId,
        player.puuid,
        player.riot_id,
        player.tagline,

      );

      addedCount++;
    }

    await updateGameEmbed(interaction, gameId);

    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `ボイスチャンネル「${voiceChannel.name}」から ${addedCount} 人の参加者を追加しました。`
        ),
      ],
    });
  } catch (error) {
    console.error("VC参加者追加エラー:", error);
    await interaction.editReply({
      embeds: [
        createErrorEmbed(
          "ボイスチャンネル参加者の追加中にエラーが発生しました。"
        ),
      ],
    });
  }
};
