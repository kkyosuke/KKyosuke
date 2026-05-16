import type { SlackAPIClient } from "slack-cloudflare-workers";

const ATTENDANCE_CHANNEL_ID = "C04DQHBE1PS";

function getTodayJST(): string {
	const formatter = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(new Date()).replace(/\//g, "-");
}

const actionTypeToText: Record<string, string> = {
	clock_in: "出勤",
	clock_out: "退勤",
	break_begin: "休憩",
	break_end: "再開",
};

export async function notifyAttendanceToSlack(
	client: SlackAPIClient,
	userId: string,
	type: "clock_in" | "clock_out" | "break_begin" | "break_end"
) {
	try {
		const today = getTodayJST();
		const threadTitle = `[${today}]勤怠報告`;
		const actionText = actionTypeToText[type] || type;

		// Get recent 5 messages from the attendance channel
		const historyRes = await client.conversations.history({
			channel: ATTENDANCE_CHANNEL_ID,
			limit: 5,
		});

		if (!historyRes.messages) {
			console.log("No messages found in the attendance channel");
			return;
		}

		// Find today's thread
		const targetMessage = historyRes.messages.find(
			(msg) => msg.text && msg.text.includes(threadTitle)
		);

		if (targetMessage && targetMessage.ts) {
			// Post result to the thread
			await client.chat.postMessage({
				channel: ATTENDANCE_CHANNEL_ID,
				thread_ts: targetMessage.ts,
				text: `<@${userId}> さんが ${actionText} しました。`,
			});
		} else {
			console.log("Today's attendance thread not found.");
		}
	} catch (e) {
		console.error("Failed to notify attendance to slack:", e);
	}
}
