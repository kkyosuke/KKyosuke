import type { CustomAppEnv } from "../../config/env";

/**
 * コマンド実行時のコンテキスト
 */
export interface CommandContext {
	env: Partial<CustomAppEnv>;
	installationId: number;
	owner: string;
	repo: string;
	issueNumber: number; // PR or Issue number
	commentBody: string; // 実際のコメント全文
	commentId?: number; // トリガーとなったコメントのID
	isReviewSummary?: boolean; // トリガーがレビューサマリ（pull_request_review）かどうか
	botName: string; // メンションに使用するBotの名前
	sender: string; // コマンドを実行したユーザー名
}

/**
 * コマンドの定義
 */
export interface CommandJob {
	name: string;
	triggerWords: string[]; // このコマンドが反応するキーワード
	priority?: number; // 判定の優先順位（大きいほど優先）
	execute: (ctx: CommandContext) => Promise<void>;
}
