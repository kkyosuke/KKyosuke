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

function getStartOfTodayJSTUnix(): string {
	const formatter = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const [year, month, day] = formatter
		.format(new Date())
		.split("/")
		.map(Number);
	return Math.floor(Date.UTC(year, month - 1, day, -9, 0, 0, 0) / 1000).toString();
}

const actionTypeToText: Record<string, string> = {
	clock_in: "出勤しました :accelhack:",
	clock_in_office: "出勤しました :accelhack:",
	clock_in_remote: "出勤しました :home:",
	clock_in_other: "出勤しました :briefcase:",
	clock_out: "退勤しました :wave:",
	break_begin: "休憩に入ります :doughnut:",
	break_end: "再開します :rocket:",
};

export async function notifyAttendanceToSlack(
	client: SlackAPIClient,
	userId: string,
	type: string,
) {
	try {
		const today = getTodayJST();
		const threadTitle = `[${today}]勤怠報告`;
		const actionText = actionTypeToText[type] || type;

		// Get messages from today in the attendance channel
		const historyRes = await client.conversations.history({
			channel: ATTENDANCE_CHANNEL_ID,
			oldest: getStartOfTodayJSTUnix(),
		});

		if (!historyRes.messages) {
			console.log("No messages found in the attendance channel");
			return;
		}

		// Find today's thread
		const targetMessage = historyRes.messages.find((msg) =>
			msg.text?.includes(threadTitle) && msg.username === "勤怠報告",
		);

		if (targetMessage?.ts) {
			// Post result to the thread
			await client.chat.postMessage({
				channel: ATTENDANCE_CHANNEL_ID,
				thread_ts: targetMessage.ts,
				text: `<@${userId}> さんが ${actionText}`,
			});
		} else {
			console.log("Today's attendance thread not found.");
		}
	} catch (e) {
		console.error("Failed to notify attendance to slack:", e);
	}
}
