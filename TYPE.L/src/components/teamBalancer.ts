import { MessageFlags } from "discord.js";
import { updateGameEmbed } from "../components/gameUI";
import { getPlayer } from "../db";
import { gameDB } from "../db/gameDB";
import { createCustomBalanceEmbed } from "../lib/embeds";
import { getMethodName } from "../lib/gameUtils";
import type { ParticipantData } from "../types/types";

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

// チーム分け方法選択ハンドラー
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

// 勝率ベースの振り分け
async function balanceTeamsByWinrate(participants: any[]) {
  // プレイヤーの勝率データ取得
  const playerScores = await Promise.all(
    participants.map(async (p) => {
      const player = getPlayer(p.user_id);
      if (!player) return { ...p, score: 50 }; // デフォルト値

      // 勝率スコア計算
      const score =
        player.solo_tier !== "UNRANKED" ? calculateWinrateScore(player) : 50;

      return { ...p, score };
    })
  );

  // スコアの高い順にソート
  const sorted = playerScores.sort((a, b) => b.score - a.score);

  // チームに振り分け
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

    // ランクスコア計算
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

  // 振り分け
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

    // レーン内でのソート
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

// ランク関連の型定義
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

// ランクスコア計算用ヘルパー関数
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

// 勝率スコア計算用ヘルパー関数
function calculateWinrateScore(player: {
  solo_tier: any;
  solo_division: any;
  solo_lp: any;
}) {
  // ランクとLPから簡易的なスコア計算
  const baseScore = calculateRankScore(player.solo_tier, player.solo_division);
  const lpBonus = parseInt(player.solo_lp || 0) / 100;
  return baseScore + lpBonus;
}
