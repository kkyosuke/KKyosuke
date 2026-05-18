import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";

export const buildSettingsBlocks = async (
	userId: string,
	env: CustomAppEnv,
): Promise<AnyHomeTabBlock[]> => {
	const slackToken = env.SLACK_BOT_TOKEN;
	if (!slackToken) {
		return [];
	}

	try {
		const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
			headers: {
				Authorization: `Bearer ${slackToken}`,
			},
		});

		const data = (await res.json()) as {
			ok: boolean;
			user?: { is_primary_owner?: boolean };
		};
		if (!data.ok || !data.user?.is_primary_owner) {
			return []; // プライマリーオーナー以外には何も表示しない
		}

		return [
			{
				type: "divider",
			},
			{
				type: "header",
				text: {
					type: "plain_text",
					text: "⚙️ システム設定",
					emoji: true,
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "*ステータス: 未定 (TBD)*\n設定画面に表示する具体的な項目や内容については、現在未定です。今後要件が固まり次第追加されます。",
				},
			},
		];
	} catch (e) {
		console.error("Failed to fetch user info for settings blocks:", e);
		return [];
	}
};
