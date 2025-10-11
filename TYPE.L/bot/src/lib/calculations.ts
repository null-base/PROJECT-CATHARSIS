export const processMatchStats = (matches: any[], puuid: string) => {
  const stats = {
    total: { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 },
    champions: new Map<string, any>(),
    lanes: new Map<string, any>(),
  };

  for (const match of matches) {
    const participant = match.info.participants.find(
      (p: any) => p.puuid === puuid
    );
    if (!participant) continue;

    // Update total stats
    stats.total.games++;
    stats.total.wins += participant.win ? 1 : 0;
    stats.total.kills += participant.kills;
    stats.total.deaths += participant.deaths;
    stats.total.assists += participant.assists;

    // Update champion stats
    const champion = participant.championName;
    if (!stats.champions.has(champion)) {
      stats.champions.set(champion, {
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
      });
    }
    const champStats = stats.champions.get(champion);
    champStats.games++;
    champStats.wins += participant.win ? 1 : 0;
    champStats.kills += participant.kills;
    champStats.deaths += participant.deaths;
    champStats.assists += participant.assists;

    // Update lane stats
    let lane = participant.lane;
    if (lane === "BOTTOM")
      lane = participant.role.includes("SUPPORT") ? "SUPPORT" : "BOTTOM";
    if (!stats.lanes.has(lane)) {
      stats.lanes.set(lane, {
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
      });
    }
    const laneStats = stats.lanes.get(lane);
    laneStats.games++;
    laneStats.wins += participant.win ? 1 : 0;
    laneStats.kills += participant.kills;
    laneStats.deaths += participant.deaths;
    laneStats.assists += participant.assists;
  }

  return stats;
};

export type ProcessedStats = {
  total: {
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  };
  champions: Map<string, any>;
  lanes: Map<string, any>;
};
