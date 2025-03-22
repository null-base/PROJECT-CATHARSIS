import { ChannelType, EmbedBuilder, MessageFlags } from "discord.js";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { createCustomBalanceEmbed, createCustomGameEmbed } from "../lib/embeds";
import type { ParticipantData } from "../types/types";

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

// handleTeamBalance 関数を更新

export const handleTeamBalance = async (interaction: any, gameId: string) => {
  await interaction.deferReply();

  try {
    // ゲーム情報を取得（バランス方法も取得）
    const game = gameDB.getGame(gameId);
    if (!game) {
      return await interaction.editReply({
        content: "⚠️ ゲームが見つかりません。",
      });
    }

    // 参加者取得
    const participants = gameDB.getParticipants(gameId);

    if (participants.length < 2) {
      return await interaction.editReply({
        content: "⚠️ チーム分けには最低2人の参加者が必要です。",
      });
    }

    // バランス方法に基づいてチーム分け
    const method = game.balance_method || "random";

    // 選択された方法でチーム分け
    const teams = await balanceTeamsByMethod(participants, method);
    const teamA = teams.teamA;
    const teamB = teams.teamB;

    // チーム情報をDBに記録
    await Promise.all([
      ...teamA.map((p) => gameDB.updateParticipantTeam(gameId, p.user_id, "A")),
      ...teamB.map((p) => gameDB.updateParticipantTeam(gameId, p.user_id, "B")),
    ]);

    // チーム分け結果のEmbedを作成
    const embed = createCustomBalanceEmbed(teamA, teamB);
    embed.setTitle(`⚖️ チームバランス結果 (${getMethodName(method)})`);

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

// チーム分け方法ごとの処理を実装
async function balanceTeamsByMethod(
  participants: ParticipantData[],
  method: any
) {
  switch (method) {
    case "winrate":
      return await balanceTeamsByWinrate(participants);
    case "level":
      return balanceTeamsByLevel(participants);
    case "rank":
      return balanceTeamsByRank(participants);
    case "lane":
      return balanceTeamsByLaneScore(participants);
    case "random":
    default:
      return balanceTeamsByRandom(participants);
  }
}

// ランダム振り分け
function balanceTeamsByRandom(participants: ParticipantData[]) {
  // 参加者をランダムにシャッフル
  const shuffled = [...participants].sort(() => 0.5 - Math.random());

  // 半分ずつチームに分割
  const half = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  return { teamA, teamB };
}

// レベルベースの振り分け
function balanceTeamsByLevel(participants: ParticipantData[]) {
  // レベル順にソート
  const sorted = [...participants].sort((a, b) => {
    const levelA = getPlayer(a.user_id)?.level || 0;
    const levelB = getPlayer(b.user_id)?.level || 0;
    return levelB - levelA;
  });

  // スネーク式に振り分け（1,4,5,8... vs 2,3,6,7...）
  const teamA: any[] = [];
  const teamB: ParticipantData[] = [];

  sorted.forEach((player, index) => {
    if (index % 4 === 0 || index % 4 === 3) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
  });

  return { teamA, teamB };
}

// 勝率ベースの振り分け (非同期)
async function balanceTeamsByWinrate(participants: any[]) {
  // プレイヤーの勝率データ取得（リアルタイム計算が必要）
  const playerScores = await Promise.all(
    participants.map(async (p) => {
      const player = getPlayer(p.user_id);
      if (!player) return { ...p, score: 50 }; // デフォルト値

      // 仮の勝率スコア (実際はより詳細な計算が必要)
      const score =
        player.solo_tier !== "UNRANKED" ? calculateWinrateScore(player) : 50;

      return { ...p, score };
    })
  );

  // スコアの高い順にソート
  const sorted = playerScores.sort((a, b) => b.score - a.score);

  // チームに振り分け（スネーク方式）
  const teamA = [];
  const teamB = [];
  let totalA = 0;
  let totalB = 0;

  // トップ2人を別チームへ
  teamA.push(sorted[0]);
  totalA += sorted[0].score;
  teamB.push(sorted[1]);
  totalB += sorted[1].score;

  // 残りはスコアバランスで振り分け
  for (let i = 2; i < sorted.length; i++) {
    if (totalA <= totalB) {
      teamA.push(sorted[i]);
      totalA += sorted[i].score;
    } else {
      teamB.push(sorted[i]);
      totalB += sorted[i].score;
    }
  }

  return { teamA, teamB };
}

// ランクベースの振り分け
function balanceTeamsByRank(participants: { user_id: string }[]) {
  // ランクスコア計算
  const playerScores = participants.map((p: { user_id: string }) => {
    const player = getPlayer(p.user_id);
    if (!player) return { ...p, score: 0 };

    // ランクスコア計算 (仮の実装)
    const soloScore = calculateRankScore(
      player.solo_tier,
      player.solo_division
    );
    const flexScore = calculateRankScore(
      player.flex_tier,
      player.flex_division
    );
    const score = Math.max(soloScore, flexScore);

    return { ...p, score };
  });

  // 同様のスネーク方式で振り分け
  const sorted = playerScores.sort(
    (a: { score: number }, b: { score: number }) => b.score - a.score
  );
  const teamA = [];
  const teamB = [];
  let totalA = 0;
  let totalB = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      teamA.push(sorted[i]);
      totalA += sorted[i].score;
    } else if (i === 1) {
      teamB.push(sorted[i]);
      totalB += sorted[i].score;
    } else {
      if (totalA <= totalB) {
        teamA.push(sorted[i]);
        totalA += sorted[i].score;
      } else {
        teamB.push(sorted[i]);
        totalB += sorted[i].score;
      }
    }
  }

  return { teamA, teamB };
}

// ランクティアと部門の型定義を追加
type RankTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER"
  | "UNRANKED";
type Division = "I" | "II" | "III" | "IV" | "";

// ランクスコア計算用ヘルパー関数を修正
function calculateRankScore(tier: string, division: string) {
  const tierScores: Record<RankTier, number> = {
    IRON: 1,
    BRONZE: 2,
    SILVER: 3,
    GOLD: 4,
    PLATINUM: 5,
    EMERALD: 6,
    DIAMOND: 7,
    MASTER: 8,
    GRANDMASTER: 9,
    CHALLENGER: 10,
    UNRANKED: 0,
  };

  const divisionScores: Record<Division, number> = {
    I: 0.75,
    II: 0.5,
    III: 0.25,
    IV: 0,
    "": 0,
  };

  // 型安全なキーチェック
  const tierScore = tier in tierScores ? tierScores[tier as RankTier] : 0;
  const divScore =
    division in divisionScores ? divisionScores[division as Division] : 0;

  return tierScore + divScore;
}

// レーンスコアベースの振り分け
function balanceTeamsByLaneScore(participants: any[]) {
  // レーン別のグループ分け
  const lanes: Record<string, ParticipantData[]> = {};
  participants.forEach((p) => {
    const lane = p.lane || "FILL";
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push(p);
  });

  // 各レーンでスコアに基づいて振り分け
  const teamA: any[] = [];
  const teamB: any[] = [];

  // メインレーン処理
  ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"].forEach((lane) => {
    if (!lanes[lane] || lanes[lane].length === 0) return;

    // レーン内でのソート (仮の実装)
    const sorted = [...lanes[lane]].sort((a, b) => {
      const playerA = getPlayer(a.user_id);
      const playerB = getPlayer(b.user_id);
      const scoreA = playerA
        ? calculateRankScore(playerA.solo_tier, playerA.solo_division)
        : 0;
      const scoreB = playerB
        ? calculateRankScore(playerB.solo_tier, playerB.solo_division)
        : 0;
      return scoreB - scoreA;
    });

    // 交互に振り分け
    sorted.forEach((player, idx) => {
      if (idx % 2 === 0) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  });

  // FILL処理
  if (lanes["FILL"] && lanes["FILL"].length > 0) {
    const fillPlayers = [...lanes["FILL"]];
    fillPlayers.forEach((player) => {
      if (teamA.length <= teamB.length) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    });
  }

  return { teamA, teamB };
}

// 勝率スコア計算用ヘルパー関数
function calculateWinrateScore(player: {
  user_id?: string;
  puuid?: string;
  riot_id?: string;
  tagline?: string;
  region?: string;
  solo_tier: any;
  solo_division: any;
  solo_lp: any;
  flex_tier?: string;
  flex_division?: string;
  flex_lp?: number;
  level?: number;
  profile_icon_id?: number;
}) {
  // 仮の実装: ランクとLPから簡易的なスコア計算
  const baseScore = calculateRankScore(player.solo_tier, player.solo_division);
  const lpBonus = parseInt(player.solo_lp || 0) / 100;
  return baseScore + lpBonus;
}

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
      });

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
  try {
    // ゲーム情報を取得
    const game = gameDB.getGame(gameId);
    if (!game) return;

    // 参加者情報を取得
    const participants = gameDB.getParticipants(gameId);

    // チーム分け方法を取得 (なければデフォルトの "random")
    const balanceMethod = game.balance_method || "random";

    // 新しいEmbedを作成 (チーム分け方法を渡す)
    const embed = createCustomGameEmbed(gameId, participants, balanceMethod);

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
  } catch (error) {
    console.error("Embed更新エラー:", error);
  }
};

export const handleBalanceMethodSelect = async (
  interaction: any,
  gameId: string
) => {
  try {
    const method = interaction.values[0];

    // deferUpdateを使用してインタラクションを更新中として返答
    await interaction.deferUpdate();

    // 選択された方法をゲーム情報に保存
    gameDB.updateGameBalanceMethod(gameId, method);

    // ゲームEmbedを更新して新しいチーム分け方法を表示
    await updateGameEmbed(interaction, gameId);

    // 成功メッセージを表示
    await interaction.followUp({
      content: `✅ チーム分け方法を **${getMethodName(
        method
      )}** に設定しました。`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("チーム分け方法選択エラー:", error);
    await interaction.followUp({
      content: "⚠️ チーム分け方法の選択中にエラーが発生しました。",
      flags: MessageFlags.Ephemeral,
    });
  }
};

function getMethodName(method: string): string {
  const methodNames: Record<string, string> = {
    random: "ランダム",
    winrate: "勝率バランス",
    level: "レベル均等",
    rank: "ランク均等",
    lane: "レーン実力",
  };
  return methodNames[method] || "不明";
}
