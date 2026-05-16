import { availableCommands } from "./index";
import type { SlackEventRequest, SlackMentionContext } from "./types";

export const routeMentionEvent = async (req: SlackEventRequest) => {
	const payload = req.payload as {
		text?: string;
		channel?: string;
		thread_ts?: string;
		ts?: string;
	};

	const text = payload.text || "";
	const channelId = payload.channel;
	const threadTs = payload.thread_ts || payload.ts;

	if (!channelId || !threadTs) {
		console.warn(
			"[SlackRouter] Missing channelId or threadTs in mention event",
		);
		return;
	}

	const ctx: SlackMentionContext = {
		req,
		text,
		channelId,
		threadTs,
	};

	// 優先度が高い順にソート（未設定の場合は0）
	const sortedCommands = [...availableCommands].sort((a, b) => {
		const pA = a.priority ?? 0;
		const pB = b.priority ?? 0;
		return pB - pA;
	});

	for (const command of sortedCommands) {
		const isTriggered = command.triggerWords.some((word) =>
			ctx.text.includes(word),
		);
		if (isTriggered) {
			console.log(`[SlackRouter] Executing command: ${command.name}`);
			await command.execute(ctx);
			return;
		}
	}

	console.log(
		`[SlackRouter] Ignored mention: no matching command. Body: "${ctx.text.slice(0, 20)}..."`,
	);
};
