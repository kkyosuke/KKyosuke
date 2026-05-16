import type { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../handlers/slack";
import { getDatabaseClient } from "../../lib/db";
import { summarizeThread } from "../../lib/llm/summary";

type ShortcutHandlerArgs = Parameters<SlackApp<CustomAppEnv>["shortcut"]>;
type AckFn = ShortcutHandlerArgs[1];
type LazyFn = NonNullable<ShortcutHandlerArgs[2]>;

export const summaryShortcutAck: AckFn = async (_req) => {
	return "";
};

export const summaryShortcutLazy: LazyFn = async (req) => {
	try {
		const payload = req.payload as {
			channel?: { id: string };
			message?: { ts: string; thread_ts?: string };
			user?: { id: string };
		};
		const channel_id = payload.channel?.id;
		// メッセージショートカットの場合、対象メッセージがスレッド内なら message.thread_ts、スレッドの親なら message.ts を使う
		const thread_ts = payload.message?.thread_ts || payload.message?.ts;

		if (!channel_id || !thread_ts) {
			console.error("Missing required ids for summary");
			return;
		}

		await executeSummary(req.context.client, req.env, channel_id, thread_ts);
	} catch (error) {
		console.error("Failed to save summary:", error);
	}
};

import type { SlackMentionCommand } from "./types";

export const summaryMentionCommand: SlackMentionCommand = {
	name: "Summary",
	triggerWords: ["日報をまとめて"],
	execute: async (ctx) => {
		try {
			console.log("[SlackRouter] Executing summaryMentionCommand");



			await executeSummary(
				ctx.req.context.client,
				ctx.req.env,
				ctx.channelId,
				ctx.threadTs,
			);
		} catch (error) {
			console.error("Failed to save summary from mention:", error);
		}
	},
};

type SlackClient = Parameters<LazyFn>[0]["context"]["client"];

async function executeSummary(
	client: SlackClient,
	env: CustomAppEnv,
	channel_id: string,
	thread_ts: string,
) {
	try {
		// スレッドの履歴を取得
		const replies = await client.conversations.replies({
			channel: channel_id,
			ts: thread_ts,
		});

		type SlackMessage = {
			user?: string;
			text?: string;
			ts?: string;
			bot_id?: string;
		};
		const messages = (replies.messages || []) as SlackMessage[];
		if (messages.length === 0) {
			return;
		}

		// ボット以外のユーザーのメッセージのみを対象とする
		const uniqueUsers = Array.from(
			new Set(
				messages
					.filter((m) => !m.bot_id && m.user)
					.map((m) => m.user as string),
			),
		);

		if (uniqueUsers.length === 0) {
			await client.chat.postMessage({
				channel: channel_id,
				thread_ts: thread_ts,
				text: "📝 要約するユーザーの投稿が見つかりませんでした。",
			});
			return;
		}

		const firstMessage = messages[0];
		if (!firstMessage) {
			return;
		}
		const firstTs = firstMessage.ts
			? parseFloat(firstMessage.ts) * 1000
			: Date.now();
		const threadTitleDate = new Date(firstTs).toLocaleString("ja-JP", {
			timeZone: "Asia/Tokyo",
		});
		const threadTitleText = `[${threadTitleDate}] <@${firstMessage.user}>: ${firstMessage.text}`;

		// LLMに渡すためのテキストフォーマット（投稿日時付き）
		const allContent = messages
			.filter((m) => !m.bot_id && m.user)
			.map((m) => {
				const ts = m.ts ? parseFloat(m.ts) * 1000 : Date.now();
				const date = new Date(ts).toLocaleString("ja-JP", {
					timeZone: "Asia/Tokyo",
				});
				return `[${date}] <@${m.user}>: ${m.text}`;
			})
			.join("\n\n");

		const threadContent = `【スレッドの最初のメッセージ（スレッド名）】\n${threadTitleText}\n\n【参加者の投稿一覧】\n${allContent}`;

		// 要約の生成
		const summaryData = await summarizeThread(
			env as unknown as Record<string, string | undefined>,
			threadContent,
		);

		const dbClient = getDatabaseClient(
			env as unknown as {
				AI_KYOSUKE_DB?: import("@cloudflare/workers-types").D1Database;
			},
		);
		for (const userSummary of summaryData.summary) {
			// D1（またはローカルSQLite）に進捗として保存
			const id = crypto.randomUUID();
			await dbClient.insertProgressSummary({
				id,
				userId: userSummary.user_id,
				targetDate: summaryData.target_date,
				progressPercent: userSummary.progress,
				evaluationScore: userSummary.score,
				summaryText: userSummary.text,
			});
		}

		// Slackのスレッドに結果を返信
		await client.chat.postMessage({
			channel: channel_id,
			thread_ts: thread_ts,
			text: `📝 進捗をまとめて保存しました！`,
		});
	} catch (error) {
		console.error("executeSummary Error:", error);
		throw error;
	}
}
