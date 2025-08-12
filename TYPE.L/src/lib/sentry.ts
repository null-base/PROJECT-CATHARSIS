import * as Sentry from "@sentry/bun";
import { IS_DEVELOPMENT } from "./config";

// Sentryの初期化
export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enableLogs: true,
    environment: IS_DEVELOPMENT ? "development" : "production",

    // サンプリングレート（本番環境では調整推奨）
    tracesSampleRate: IS_DEVELOPMENT ? 1.0 : 0.1,

    // デバッグモード（開発環境のみ）
    debug: IS_DEVELOPMENT,

    // エラーフィルタリング（必要に応じて調整）
    beforeSend(event) {
      // 開発環境では全て送信、本番環境では重要なエラーのみ
      if (IS_DEVELOPMENT) return event;

      // 特定のエラーを除外する場合はここで設定
      return event;
    },
  });
}

// エラーキャプチャのヘルパー関数
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    tags: context,
  });
}

// メッセージキャプチャのヘルパー関数
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
) {
  Sentry.captureMessage(message, level);
}
