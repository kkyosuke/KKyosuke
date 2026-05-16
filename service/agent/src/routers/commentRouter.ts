import type { CommandContext } from "../jobs";
import { availableCommands } from "../jobs";

export const routeCommentCommand = async (ctx: CommandContext) => {
	const triggerMention = `@${ctx.botName}`;

	// メンションが含まれていない場合は無視
	if (!ctx.commentBody.includes(triggerMention)) {
		return;
	}

	// 優先度が高い順にソート（未設定の場合は0）
	const sortedCommands = [...availableCommands].sort((a, b) => {
		const pA = a.priority ?? 0;
		const pB = b.priority ?? 0;
		return pB - pA;
	});

	for (const command of sortedCommands) {
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
