import type { MessageBatch } from "@cloudflare/workers-types";
import type { CustomAppEnv } from "../config/env";
import { getBotName } from "../config/env";
import { replyCommand, reReviewCommand } from "../jobs/github";
import type { ReviewQueueMessage } from "../jobs/github/queue";
import { routeCommentCommand } from "../jobs/github/router";
import type { CommandContext } from "../jobs/github/types";

export async function queueHandler(
	batch: MessageBatch<ReviewQueueMessage>,
	env: Partial<CustomAppEnv>,
): Promise<void> {
	for (const msg of batch.messages) {
		try {
			const { type, payload } = msg.body;
			const ctx: CommandContext = {
				...payload,
				env,
				botName: getBotName(env),
			};

			console.log(
				`[Queue] Processing message type: ${type} for PR #${ctx.issueNumber}`,
			);

			switch (type) {
				case "route-comment":
					await routeCommentCommand(ctx);
					break;
				case "re-review":
					await reReviewCommand.execute(ctx);
					break;
				case "reply":
					await replyCommand.execute(ctx);
					break;
				default:
					console.warn(`[Queue] Unknown message type: ${type}`);
			}
			msg.ack();
		} catch (error) {
			console.error(`[Queue] Error processing message:`, error);
			msg.retry();
		}
	}
}
