import type { CommandContext, CommandJob } from "../types";
import { runReviewAgent } from "./agent";

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
			ctx.botName,
		);
	},
};
