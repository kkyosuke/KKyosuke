import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { getDailyNews } from "../../../lib/news";

export const buildNewsBlocks = async (
	env: CustomAppEnv,
): Promise<AnyHomeTabBlock[]> => {
	const news = await getDailyNews(env);

	if (!news) {
		return [];
	}

	return [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "📰 今日の注目ITニュース",
				emoji: true,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*<${news.url}|${news.title}>*\n${news.comment}`,
			},
		},
		{
			type: "divider",
		},
	];
};
