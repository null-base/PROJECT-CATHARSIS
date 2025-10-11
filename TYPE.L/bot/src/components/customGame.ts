import { createNewCustomGame } from "./gameCreation";
import { handleEndGame } from "./gameManagement";
import {
  handleJoinGame,
  handleLaneSelect,
  handleLeaveGame,
  handleVoiceJoin,
} from "./gameParticipation";
import {
  displayGameResult,
  handleEndTracking,
  handleShowResult,
  handleTrackGame,
} from "./gameTracker";
import {
  handleBalanceMethodSelect,
  handleTeamBalance,
} from "./teamBalancer";
import { updateGameEmbed } from "./gameUI";

// 他のファイルから必要な関数をエクスポート
export {
  // ゲーム作成
  createNewCustomGame,
  displayGameResult,
  handleBalanceMethodSelect,
  // ゲーム管理
  handleEndGame,
  handleEndTracking,
  // ゲーム参加関連
  handleJoinGame,
  handleLaneSelect,
  handleLeaveGame,
  handleShowResult,
  // チーム分け関連
  handleTeamBalance,
  // ゲーム追跡関連
  handleTrackGame,
  handleVoiceJoin,
  // UI更新
  updateGameEmbed,
};
