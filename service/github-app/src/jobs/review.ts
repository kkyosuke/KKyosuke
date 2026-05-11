import { runReviewAgent } from "./reviewAgent";
import type { CommandContext, CommandJob } from "./types";

export const reviewCommand: CommandJob = {
	name: "review",
	triggerWords: ["レビューして", "review"],
	execute: async (ctx: CommandContext) => {
		await runReviewAgent(
			ctx.env,
			ctx.installationId,
			ctx.owner,
			ctx.repo,
			ctx.issueNumber,
		);
	},
};
