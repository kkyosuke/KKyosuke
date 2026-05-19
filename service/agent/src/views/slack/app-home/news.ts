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
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*📰 今日の注目ITニュース*\n*<${news.url}|${news.title}>*\n${news.comment}`,
			},
		},
		{
			type: "divider",
		},
	];
};
