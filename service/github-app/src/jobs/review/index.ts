import { getIssueComments, getReviewComments } from "../../lib/github";
import { runReReviewAgent } from "../re-review/agent";
import type { CommandContext, CommandJob } from "../types";
import { runReviewAgent } from "./agent";

export const reviewCommand: CommandJob = {
	name: "review",
	triggerWords: ["レビューして", "review"],
	execute: async (ctx: CommandContext) => {
		// 過去のコメントを取得して、Botがすでにレビュー済みか判定する
		try {
			const issueComments = await getIssueComments(
				ctx.env,
				ctx.installationId,
				ctx.owner,
				ctx.repo,
				ctx.issueNumber,
			);
			const reviewComments = await getReviewComments(
				ctx.env,
				ctx.installationId,
				ctx.owner,
				ctx.repo,
				ctx.issueNumber,
			);

			const hasBotComments =
				issueComments.some(
					(c) =>
						c.user?.type === "Bot" ||
						c.user?.login?.toLowerCase().includes("bot") ||
						c.user?.login?.includes("ai"),
				) ||
				reviewComments.some(
					(c) =>
						c.user?.type === "Bot" ||
						c.user?.login?.toLowerCase().includes("bot") ||
						c.user?.login?.includes("ai"),
				);

			if (hasBotComments) {
				console.log(
					`[ReviewCommand] Bot has commented before on #${ctx.issueNumber}. Routing to Re-Review Agent.`,
				);
				await runReReviewAgent(
					ctx.env,
					ctx.installationId,
					ctx.owner,
					ctx.repo,
					ctx.issueNumber,
				);
				return;
			}
		} catch (error) {
			console.warn(
				"[ReviewCommand] Failed to check previous comments. Proceeding with normal review.",
				error,
			);
		}

		await runReviewAgent(
			ctx.env,
			ctx.installationId,
			ctx.owner,
			ctx.repo,
			ctx.issueNumber,
		);
	},
};
