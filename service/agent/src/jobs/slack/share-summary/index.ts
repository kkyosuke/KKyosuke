import type { CustomAppEnv } from "../../../handlers/slack";
import { getDatabaseClient } from "../../../lib/db";
import { generateWeeklyShareSummary } from "../../../lib/llm/share-summary";
import type { SlackMentionCommand } from "../types";

export const shareSummaryMentionCommand: SlackMentionCommand = {
	name: "ShareSummary",
	triggerWords: ["今週の進捗をまとめて"],
	execute: async (ctx) => {
		try {
			console.log("[SlackRouter] Executing shareSummaryMentionCommand");

			await executeShareSummary(
				ctx.req.context.client,
				ctx.req.env,
				ctx.channelId,
				ctx.threadTs,
			);
		} catch (error) {
			console.error("Failed to share summary from mention:", error);
		}
	},
};

type SlackClient = Parameters<
	SlackMentionCommand["execute"]
>[0]["req"]["context"]["client"];

async function executeShareSummary(
	client: SlackClient,
	env: CustomAppEnv,
	channel_id: string,
	thread_ts: string,
) {
	try {
		// Calculate dates for this week and last week (JST)
		const now = new Date();
		const jstOffset = 9 * 60 * 60 * 1000;
		const nowJst = new Date(now.getTime() + jstOffset);

		const formatDate = (d: Date) => d.toISOString().split("T")[0] as string;

		const thisWeekEnd = new Date(nowJst);
		const thisWeekStart = new Date(nowJst);
		thisWeekStart.setDate(thisWeekStart.getDate() - 6);

		const lastWeekEnd = new Date(thisWeekStart);
		lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
		const lastWeekStart = new Date(lastWeekEnd);
		lastWeekStart.setDate(lastWeekStart.getDate() - 6);

		const thisWeekStartStr = formatDate(thisWeekStart);
		const thisWeekEndStr = formatDate(thisWeekEnd);
		const lastWeekStartStr = formatDate(lastWeekStart);
		const lastWeekEndStr = formatDate(lastWeekEnd);

		const dbClient = getDatabaseClient(
			env as unknown as {
				AI_KYOSUKE_DB?: import("@cloudflare/workers-types").D1Database;
			},
		);

		// Fetch summaries
		const thisWeekSummaries = await dbClient.getProgressSummariesByDateRange(
			thisWeekStartStr,
			thisWeekEndStr,
		);
		const lastWeekSummaries = await dbClient.getProgressSummariesByDateRange(
			lastWeekStartStr,
			lastWeekEndStr,
		);

		if (thisWeekSummaries.length === 0) {
			await client.chat.postMessage({
				channel: channel_id,
				thread_ts: thread_ts,
				text: "今週の進捗データがありませんでした。",
			});
			return;
		}

		// Prepare LLM input
		const formatSummary = (
			s: Awaited<
				ReturnType<typeof dbClient.getProgressSummariesByDateRange>
			>[number],
		) =>
			`UserID: <@${s.userId}>, Date: ${s.targetDate}, Progress: ${s.progressPercent}%, Score: ${s.evaluationScore}, Summary: ${s.summaryText}`;

		const thisWeekDataStr = thisWeekSummaries.map(formatSummary).join("\n");
		const lastWeekDataStr = lastWeekSummaries.map(formatSummary).join("\n");

		// Generate AI summary
		const result = await generateWeeklyShareSummary(
			env as unknown as Record<string, string | undefined>,
			lastWeekDataStr,
			thisWeekDataStr,
		);

		// Format output for Slack
		// biome-ignore lint/suspicious/noExplicitAny: slack api blocks type
		const blocks: any[] = [
			{
				type: "header",
				text: {
					type: "plain_text",
					text: `📊 今週の進捗まとめ (${thisWeekStartStr} ~ ${thisWeekEndStr})`,
					emoji: true,
				},
			},
			{
				type: "divider",
			},
		];

		for (const userSummary of result.summaries) {
			blocks.push({
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*<@${userSummary.user_id}> さんの進捗*\n\n*📈 先週との比較*\n${userSummary.ratio_text}\n\n*📝 まとめ*\n${userSummary.summary_text}\n\n*🚀 来週の頑張り*\n${userSummary.next_action_text}`,
				},
			});
			blocks.push({
				type: "divider",
			});
		}

		// Slackのスレッドまたはチャンネルに結果を返信
		await client.chat.postMessage({
			channel: channel_id,
			thread_ts: thread_ts,
			blocks: blocks,
			text: "今週の進捗まとめを作成しました！", // Fallback text
		});
	} catch (error) {
		console.error("executeShareSummary Error:", error);
		throw error;
	}
}
