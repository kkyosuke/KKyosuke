import type { CommandContext } from "../jobs";
import { availableCommands } from "../jobs";

export const routeCommentCommand = async (ctx: CommandContext) => {
	const isLocal =
		typeof process !== "undefined" && process.env.NODE_ENV !== "production";
	const triggerMention = isLocal ? "@test.kkyosuke.ai" : "@kkyosuke.ai";

	// メンションが含まれていない場合は無視
	if (!ctx.commentBody.includes(triggerMention)) {
		return;
	}

	for (const command of availableCommands) {
		const isTriggered = command.triggerWords.some((word) =>
			ctx.commentBody.includes(word),
		);
		if (isTriggered) {
			console.log(`[Router] Executing command: ${command.name}`);
			await command.execute(ctx);
			return;
		}
	}

	console.log(
		`[Router] Ignored comment: mention found but no matching command. Body: "${ctx.commentBody.slice(0, 20)}..."`,
	);
};
