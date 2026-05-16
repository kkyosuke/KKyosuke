import type { CustomAppEnv } from "../../../handlers/slack";
import { getDatabaseClient } from "../../../lib/db";
import { generateWeeklyShareSummary } from "../../../lib/llm/weekly-report";
import type { SlackMentionCommand } from "../types";

export const weeklyReportMentionCommand: SlackMentionCommand = {
	name: "WeeklyReport",
	triggerWords: ["先週の進捗をまとめて"],
	execute: async (ctx) => {
		try {
			console.log("[SlackRouter] Executing weeklyReportMentionCommand");

			await executeWeeklyReport(
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

async function executeWeeklyReport(
	client: SlackClient,
	env: CustomAppEnv,
	channel_id: string,
	thread_ts: string,
) {
	try {
		// Calculate dates for last week and the week before last (JST)
		const now = new Date();
		const jstOffset = 9 * 60 * 60 * 1000;
		const nowJst = new Date(now.getTime() + jstOffset);

		const formatDate = (d: Date) => d.toISOString().split("T")[0] as string;

		// The past 7 days (Last Week, assuming it runs on Monday)
		const lastWeekEnd = new Date(nowJst);
		const lastWeekStart = new Date(nowJst);
		lastWeekStart.setDate(lastWeekStart.getDate() - 6);

		// The 7 days before that (Week Before Last)
		const weekBeforeLastEnd = new Date(lastWeekStart);
		weekBeforeLastEnd.setDate(weekBeforeLastEnd.getDate() - 1);
		const weekBeforeLastStart = new Date(weekBeforeLastEnd);
		weekBeforeLastStart.setDate(weekBeforeLastStart.getDate() - 6);

		const lastWeekStartStr = formatDate(lastWeekStart);
		const lastWeekEndStr = formatDate(lastWeekEnd);
		const weekBeforeLastStartStr = formatDate(weekBeforeLastStart);
		const weekBeforeLastEndStr = formatDate(weekBeforeLastEnd);

		const dbClient = getDatabaseClient(
			env as unknown as {
				AI_KYOSUKE_DB?: import("@cloudflare/workers-types").D1Database;
			},
		);

		// Fetch summaries
		const lastWeekSummaries = await dbClient.getProgressSummariesByDateRange(
			lastWeekStartStr,
			lastWeekEndStr,
		);
		const weekBeforeLastSummaries = await dbClient.getProgressSummariesByDateRange(
			weekBeforeLastStartStr,
			weekBeforeLastEndStr,
		);

		if (lastWeekSummaries.length === 0) {
			await client.chat.postMessage({
				channel: channel_id,
				thread_ts: thread_ts,
				text: "先週の進捗データがありませんでした。",
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

		const lastWeekDataStr = lastWeekSummaries.map(formatSummary).join("\n");
		const weekBeforeLastDataStr = weekBeforeLastSummaries.map(formatSummary).join("\n");

		// Generate AI summary
		const result = await generateWeeklyShareSummary(
			env as unknown as Record<string, string | undefined>,
			weekBeforeLastDataStr,
			lastWeekDataStr,
		);

		// Format output for Slack
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

		for (const userSummary of result.summaries) {
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

		// Slackのスレッドまたはチャンネルに結果を返信
		await client.chat.postMessage({
			channel: channel_id,
			thread_ts: thread_ts,
			blocks: blocks,
			text: "先週の進捗まとめを作成しました！", // Fallback text
		});
	} catch (error) {
		console.error("executeWeeklyReport Error:", error);
		throw error;
	}
}
