import { RiotAPI } from "../lib/riotApi";

// PUUIDによるプレイヤーマッチング
export async function matchPlayerByPUUID(participant: any, participantsMap: Map<string, any>) {
  if (participant.puuid && participantsMap.has(participant.puuid)) {
    try {
      const playerInfo = await RiotAPI.getGamenameTagline(participant.puuid);
      const displayName = `${playerInfo.gameName}#${playerInfo.tagLine}`;
      console.log(`[matchPlayerByPUUID] PUUIDでマッチング成功: ${displayName}`);
      return {
        displayName,
        matchFound: true
      };
    } catch (error) {
      console.error("[matchPlayerByPUUID] プレイヤー情報取得エラー:", error);

      // API取得に失敗した場合はローカルの情報を使用
      const playerInfo = participantsMap.get(participant.puuid);
      return {
        displayName: `${playerInfo.riot_id}#${playerInfo.tagline}`,
        matchFound: true
      };
    }
  }

  return {
    displayName: "",
    matchFound: false
  };
}

// サモナー名によるプレイヤーマッチング
export function matchPlayerByName(summonerName: string, summNameMap: Map<string, any>) {
  const normalizedName = summonerName.toLowerCase().replace(/\s+/g, "");

  // 完全一致
  if (summNameMap.has(normalizedName)) {
    const playerInfo = summNameMap.get(normalizedName);
    const displayName = `${playerInfo.riot_id}#${playerInfo.tagline}`;
    console.log(`[matchPlayerByName] 名前で完全マッチング成功: ${displayName}`);
    return {
      displayName,
      matchFound: true
    };
  }

  // 部分一致による拡張マッチング
  let bestMatchScore = 0;
  let bestMatch = null;

  for (const [key, playerInfo] of summNameMap.entries()) {
    // マッチングスコア計算
    const matchScore = calculateNameMatchScore(normalizedName, key);

    // より良いマッチを保存
    if (matchScore > bestMatchScore) {
      bestMatchScore = matchScore;
      bestMatch = playerInfo;
    }
  }

  // スコアが一定以上のマッチがあれば使用
  if (bestMatchScore >= 3 && bestMatch) {
    const displayName = `${bestMatch.riot_id}#${bestMatch.tagline}`;
    console.log(`[matchPlayerByName] 拡張マッチングで成功(スコア:${bestMatchScore}): ${displayName}`);
    return {
      displayName,
      matchFound: true
    };
  }

  return {
    displayName: "",
    matchFound: false
  };
}

// レーンとチーム情報によるプレイヤーマッチング
export function matchPlayerByLane(participant: any, botParticipants: any[]) {
  if (!participant.teamId || (participant.teamId !== 100 && participant.teamId !== 200)) {
    return {
      displayName: "",
      matchFound: false
    };
  }

  const teamLetter = participant.teamId === 100 ? "A" : "B";
  const possiblePlayers = botParticipants.filter(p => p.team === teamLetter);

  // チーム + レーンでマッチング
  if (participant.lane && possiblePlayers.length > 0) {
    const lanePlayer = possiblePlayers.find(p => {
      // レーン情報を正規化して比較
      const pLane = p.lane?.toUpperCase() || "FILL";
      let participantLane = participant.lane.toUpperCase();

      // API側のBOTTOMとSUPPORTを正確に区別
      if (participantLane === "BOTTOM" && participant.role?.includes("SUPPORT")) {
        participantLane = "SUPPORT";
      }

      return pLane === participantLane || pLane === "FILL";
    });

    if (lanePlayer) {
      const displayName = `${lanePlayer.riot_id}#${lanePlayer.tagline}`;
      console.log(`[matchPlayerByLane] レーン情報でマッチング成功: ${displayName}`);
      return {
        displayName,
        matchFound: true
      };
    }
  }

  return {
    displayName: "",
    matchFound: false
  };
}

// サモナー名のマッチングスコア計算
function calculateNameMatchScore(name1: string, name2: string): number {
  let matchScore = 0;

  // 部分一致のスコア
  if (name1.includes(name2)) matchScore += 3;
  if (name2.includes(name1)) matchScore += 2;

  // 先頭一致はより重要
  if (name1.startsWith(name2) || name2.startsWith(name1)) {
    matchScore += 2;
  }

  // 文字数の差が少ないほど良いマッチ
  const lengthDiff = Math.abs(name1.length - name2.length);
  if (lengthDiff <= 2) matchScore += 1;

  return matchScore;
}
