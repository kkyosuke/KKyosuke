import type { CustomAppEnv } from "../../../config/env";
import { SettingsManager } from "../../../config/settings";
import { getDatabaseClient } from "../../../lib/db";
import { generateWeeklyShareSummary } from "../../../lib/llm/weekly-report";
import type { AppBindings } from "../../../types/bindings";
import { buildWeeklyReportBlocks } from "../../../views/slack/weekly-report";
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

		const dbClient = getDatabaseClient(env as unknown as Partial<AppBindings>);

		const { getProgressSummariesByDateRange } = await import(
			"../../../datasource/db/progressSummary"
		);

		// Fetch summaries
		const lastWeekSummaries = await getProgressSummariesByDateRange(
			dbClient,
			lastWeekStartStr,
			lastWeekEndStr,
		);
		const weekBeforeLastSummaries = await getProgressSummariesByDateRange(
			dbClient,
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
		const formatSummary = (s: (typeof lastWeekSummaries)[number]) =>
			`UserID: <@${s.userId}>, Date: ${s.targetDate}, Progress: ${s.progressPercent}%, Score: ${s.evaluationScore}, Summary: ${s.summaryText}`;

		const lastWeekDataStr = lastWeekSummaries.map(formatSummary).join("\n");
		const weekBeforeLastDataStr = weekBeforeLastSummaries
			.map(formatSummary)
			.join("\n");

		// Generate AI summary
		const settings = new SettingsManager(env);
		const reportModel = await settings.getReportModel();

		const result = await generateWeeklyShareSummary(
			env,
			weekBeforeLastDataStr,
			lastWeekDataStr,
			reportModel,
		);

		// Format output for Slack
		const blocks = buildWeeklyReportBlocks(
			lastWeekStartStr,
			lastWeekEndStr,
			result.summaries,
		);

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
