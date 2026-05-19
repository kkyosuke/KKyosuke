import type { AnyMessageBlock } from "slack-cloudflare-workers";

export function buildWeeklyReportBlocks(
	lastWeekStartStr: string,
	lastWeekEndStr: string,
	summaries: Array<{
		user_id: string;
		ratio_text: string;
		summary_text: string;
		next_action_text: string;
	}>,
): AnyMessageBlock[] {
	// biome-ignore lint/suspicious/noExplicitAny: slack api blocks type
	const blocks: any[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `📊 先週の進捗まとめ (${lastWeekStartStr} ~ ${lastWeekEndStr})`,
				emoji: true,
			},
		},
		{
			type: "divider",
		},
	];

	for (const userSummary of summaries) {
		blocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*<@${userSummary.user_id}> さんの進捗*\n\n*📈 先々週との比較*\n${userSummary.ratio_text}\n\n*📝 まとめ*\n${userSummary.summary_text}\n\n*🚀 今週の頑張り*\n${userSummary.next_action_text}`,
			},
		});
		blocks.push({
			type: "divider",
		});
	}

	return blocks;
}
