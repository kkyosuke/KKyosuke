import type { CommandContext, CommandJob } from "../types";
import { runReReviewAgent } from "./agent";

export const reReviewCommand: CommandJob = {
	name: "re-review",
	triggerWords: ["再レビュー", "re-review", "確認して"],
	priority: 10, // 部分一致（review）より先に判定させるため優先度を上げる
	execute: async (ctx: CommandContext) => {
		await runReReviewAgent(
			ctx.env,
			ctx.installationId,
			ctx.owner,
			ctx.repo,
			ctx.issueNumber,
		);
	},
};
