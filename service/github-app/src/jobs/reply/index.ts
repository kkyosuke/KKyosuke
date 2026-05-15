import type { CommandContext, CommandJob } from "../types";
import { runReplyAgent } from "./agent";

export const replyCommand: CommandJob = {
	name: "reply",
	triggerWords: [], // 特別なトリガーワードは不要（webhook側で判定して直接呼び出すか、ルーティングで処理）
	priority: 0,
	execute: async (ctx: CommandContext) => {
		if (!ctx.commentId) {
			console.warn("[ReplyAgent] No commentId provided in context");
			return;
		}
		await runReplyAgent(
			ctx.env,
			ctx.installationId,
			ctx.owner,
			ctx.repo,
			ctx.issueNumber,
			ctx.commentId,
		);
	},
};

export * from "./agent";
