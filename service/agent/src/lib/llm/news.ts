import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { CustomAppEnv } from "../../config/env";
import { DEFAULT_REPORT_MODEL_NAME } from "./cost";
import type { NewsItem, SelectedNews } from "../news";

export const newsSelectionSchema = z.object({
	title: z.string().describe("選定したニュースのタイトル"),
	url: z.string().describe("選定したニュースのURL"),
	comment: z
		.string()
		.describe(
			"AIによる推薦コメント（なぜこれが面白いのか、ITエンジニア向けに1〜2文で）",
		),
});

/**
 * AIを用いて、リストの中からエンジニアにとって最も面白そうな記事を1つ選定させます。
 */
export async function selectInterestingNews(
	env: Partial<CustomAppEnv>,
	newsItems: NewsItem[],
): Promise<SelectedNews | null> {
	if (newsItems.length === 0) return null;

	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	// デフォルトのレポートモデルを使用するか、フォールバックとして claude-3-5-haiku-20241022 を使用
	const model = anthropic(
		DEFAULT_REPORT_MODEL_NAME || "claude-3-5-haiku-20241022",
	);

	const prompt = `以下のIT関連ニュースから、ITエンジニアにとって最も面白そうなものを1つ選び、そのタイトル、URL、そして推薦理由（1〜2文）を出力してください。

【ニュース一覧】
${newsItems.map((item, index) => `${index + 1}. ${item.title} (${item.url})`).join("\n")}
`;

	console.log("[selectInterestingNews] Sending prompt for news selection");

	try {
		const { output } = await generateText({
			model,
			prompt,
			output: Output.object({ schema: newsSelectionSchema }),
		});

		return output;
	} catch (error) {
		console.error("[selectInterestingNews] Error selecting news:", error);
		return null;
	}
}
