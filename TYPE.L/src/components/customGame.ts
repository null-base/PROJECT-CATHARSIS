import { ChannelType, EmbedBuilder, MessageFlags } from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { createCustomBalanceEmbed, createCustomGameEmbed } from "../lib/embeds";

// カスタムゲームへの参加処理
export const handleJoinGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // プレイヤー情報を取得
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return await interaction.editReply({
        content: "⚠️ 参加するには `/register` コマンドで登録が必要です。",
      });
    }

    // 参加状況を確認
    const isAlreadyJoined = gameDB.isParticipant(gameId, interaction.user.id);

    if (isAlreadyJoined) {
      return await interaction.editReply({
        content: "✅ あなたはすでに参加登録済みです。",
      });
    }

    // 参加者として登録
    gameDB.addParticipant(
      gameId,
      interaction.user.id,
      player.puuid,
      player.riot_id,
      player.tagline,
      0 // 強さの値は使用しないため0を設定
    );

    await updateGameEmbed(interaction, gameId);

    await interaction.editReply({
      content: "✅ カスタムゲームに参加しました！レーンを選択してください。",
    });
  } catch (error) {
    console.error("参加エラー:", error);
    await interaction.editReply({
      content: "⚠️ 参加処理中にエラーが発生しました。",
    });
  }
};

// レーン選択処理
export const handleLaneSelect = async (interaction: any, gameId: string) => {
  try {
    const lane = interaction.values[0];

    // 参加者データを更新
    const success = gameDB.updateParticipantLane(
      gameId,
      interaction.user.id,
      lane
    );

    if (!success) {
      return await interaction.reply({
        content: "⚠️ 参加登録が必要です。まず参加ボタンを押してください。",
        flags: MessageFlags.Ephemeral,
      });
    }

    await updateGameEmbed(interaction, gameId);

    await interaction.reply({
      content: `✅ レーンを **${lane}** に設定しました。`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("レーン選択エラー:", error);
    await interaction.reply({
      content: "⚠️ レーン選択中にエラーが発生しました。",
      flags: MessageFlags.Ephemeral,
    });
  }
};

// カスタムゲームからの退出処理
export const handleLeaveGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const success = gameDB.removeParticipant(gameId, interaction.user.id);

    if (!success) {
      return await interaction.editReply({
        content: "⚠️ あなたは参加していません。",
      });
    }

    await updateGameEmbed(interaction, gameId);

    await interaction.editReply({
      content: "✅ カスタムゲームから退出しました。",
    });
  } catch (error) {
    console.error("退出エラー:", error);
    await interaction.editReply({
      content: "⚠️ 退出処理中にエラーが発生しました。",
    });
  }
};

// VC参加者一括追加処理 (エラーハンドリング追加)
export const handleVoiceJoin = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // ユーザーがVCに参加しているか確認
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!member.voice?.channel) {
      console.log("ボイスチャンネル情報が取得できません:", member);
      return await interaction.editReply({
        content:
          "⚠️ ボイスチャンネルに参加していないか、ボイス情報を取得できません。",
      });
    }

    const voiceChannel = member.voice.channel;
    console.log(
      "VC情報:",
      voiceChannel.name,
      "参加者数:",
      voiceChannel.members.size
    );

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
        0
      );

      addedCount++;
    }

    await updateGameEmbed(interaction, gameId);

    await interaction.editReply({
      content: `✅ ボイスチャンネル「${voiceChannel.name}」から ${addedCount} 人の参加者を追加しました。`,
    });
  } catch (error) {
    console.error("VC参加者追加エラー:", error);
    await interaction.editReply({
      content: "⚠️ ボイスチャンネル参加者の追加中にエラーが発生しました。",
    });
  }
};

// チーム分け処理（ランダム方式に変更）
export const handleTeamBalance = async (interaction: any, gameId: string) => {
  await interaction.deferReply();

  try {
    // 参加者取得
    const participants = gameDB.getParticipants(gameId);

    if (participants.length < 2) {
      return await interaction.editReply({
        content: "⚠️ チーム分けには最低2人の参加者が必要です。",
      });
    }

    // 参加者をランダムにシャッフル
    const shuffled = [...participants].sort(() => 0.5 - Math.random());

    // 半分ずつチームに分割
    const half = Math.ceil(shuffled.length / 2);
    const teamA = shuffled.slice(0, half);
    const teamB = shuffled.slice(half);

    // チーム情報をDBに記録
    for (const player of teamA) {
      gameDB.updateParticipantTeam(gameId, player.user_id, "A");
    }

    for (const player of teamB) {
      gameDB.updateParticipantTeam(gameId, player.user_id, "B");
    }

    // チーム分け結果のEmbedを作成
    const embed = createCustomBalanceEmbed(teamA, teamB);

    await updateGameEmbed(interaction, gameId);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error("チーム分けエラー:", error);
    await interaction.editReply({
      content: "⚠️ チーム分け処理中にエラーが発生しました。",
    });
  }
};

// ゲーム追跡処理
export const handleTrackGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // 参加者情報を取得
    const participants = gameDB.getParticipants(gameId);

    if (participants.length === 0) {
      return await interaction.editReply({
        content: "⚠️ このゲームには参加者がいません。",
      });
    }

    // ゲームステータスを「追跡中」に更新
    gameDB.updateGameStatus(gameId, "TRACKING");

    await interaction.editReply({
      content: `✅ ゲームの追跡を開始しました。ゲーム終了後に結果が表示されます。`,
    });

    // TODO: 実際のゲーム追跡ロジックを追加（定期的にAPIを叩くなど）
  } catch (error) {
    console.error("ゲーム追跡エラー:", error);
    await interaction.editReply({
      content: "⚠️ ゲーム追跡の開始中にエラーが発生しました。",
    });
  }
};

// ゲーム終了処理
export const handleEndGame = async (interaction: any, gameId: string) => {
  await interaction.deferReply();

  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) {
      return await interaction.editReply({
        content: "⚠️ ゲームが見つかりません。",
      });
    }

    // ゲームのステータスを終了に更新
    gameDB.updateGameStatus(gameId, "COMPLETED");

    // 参加者を取得
    const participants = gameDB.getParticipants(gameId);

    // 終了メッセージ作成
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("🏁 カスタムゲーム終了")
      .setDescription(`ゲームID: ${gameId}`)
      .addFields({
        name: "参加者",
        value:
          participants.length > 0
            ? participants.map((p) => `${p.riot_id}#${p.tagline}`).join("\n")
            : "参加者なし",
        inline: false,
      })
      .setFooter({
        text: "Powered by @null_sensei • null-base.com",
        iconURL:
          "https://cdn.discordapp.com/avatars/834055392727269387/953d512ef19ef1e915fe733fa637b67e.webp",
      })
      .setTimestamp();

    // 元のメッセージを検索して更新（コンポーネントを削除）
    try {
      const channel = await interaction.client.channels.fetch(game.channel_id);
      if (channel && channel.type === ChannelType.GuildText) {
        const message = await channel.messages.fetch(game.message_id);
        if (message) {
          // コンポーネントを削除してゲーム終了状態に
          await message.edit({
            embeds: [embed],
            components: [],
          });
        }
      }
    } catch (error) {
      console.error("メッセージ更新エラー:", error);
    }

    await interaction.editReply({
      content: "✅ カスタムゲームを終了しました。",
    });
  } catch (error) {
    console.error("ゲーム終了エラー:", error);
    await interaction.editReply({
      content: "⚠️ ゲーム終了処理中にエラーが発生しました。",
    });
  }
};

// ゲーム募集Embedの更新
export const updateGameEmbed = async (interaction: any, gameId: string) => {
  // ゲーム情報を取得
  const game = gameDB.getGame(gameId);
  if (!game) return;

  // 参加者情報を取得
  const participants = gameDB.getParticipants(gameId);

  // 新しいEmbedを作成
  const embed = createCustomGameEmbed(gameId, participants);

  // 元のメッセージを検索して更新
  try {
    const channel = await interaction.client.channels.fetch(game.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const message = await channel.messages.fetch(game.message_id);
    if (!message) return;

    await message.edit({ embeds: [embed], components: message.components });
  } catch (error) {
    console.error("メッセージ更新エラー:", error);
  }
};
