import type { CustomAppEnv } from "../config/env";
import { getKVClient } from "./kv";
import { selectInterestingNews } from "./llm/news";
export interface NewsItem {
	title: string;
	url: string;
}

export interface SelectedNews {
	title: string;
	url: string;
	comment: string;
}

/**
 * YahooニュースのITトピックス（RSS）を取得し、タイトルとURLのリストを返します。
 */
export async function fetchITNews(): Promise<NewsItem[]> {
	try {
		const res = await fetch("https://news.yahoo.co.jp/rss/topics/it.xml");
		if (!res.ok) {
			console.error("[fetchITNews] RSS fetch failed:", res.statusText);
			return [];
		}
		const xmlText = await res.text();

		// 正規表現による簡易XMLパース
		// <item> ... <title>...</title> ... <link>...</link> ... </item>
		const itemRegexSimple =
			/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/g;

		const items: NewsItem[] = [];
		let match: RegExpExecArray | null = itemRegexSimple.exec(xmlText);

		while (match !== null) {
			if (items.length >= 20) break;
			items.push({
				title: match[1] || "",
				url: match[2] || "",
			});
			match = itemRegexSimple.exec(xmlText);
		}

		return items;
	} catch (error) {
		console.error("[fetchITNews] Error fetching news:", error);
		return [];
	}
}

/**
 * KVキャッシュを利用して、本日の注目ITニュースを取得します。
 * キャッシュがない場合は取得・選定を行い、KVに1日(86400秒)期限で保存します。
 */
export async function getDailyNews(
	env: CustomAppEnv,
): Promise<SelectedNews | null> {
	const kv = getKVClient(env);

	// JST（+09:00）で日付文字列（YYYY-MM-DD）を取得
	const now = new Date();
	now.setHours(now.getHours() + 9);
	const todayStr = now.toISOString().split("T")[0];
	const cacheKey = `daily_it_news_${todayStr}`;

	try {
		const cachedStr = await kv.get(cacheKey);
		if (cachedStr) {
			console.log("[getDailyNews] Cache hit:", cacheKey);
			return JSON.parse(cachedStr) as SelectedNews;
		}

		console.log("[getDailyNews] Cache miss. Fetching new news.");
		const items = await fetchITNews();
		if (items.length === 0) return null;

		const selected = await selectInterestingNews(env, items);
		if (selected) {
			// TTL 86400秒 (1日) でKVに保存
			await kv.put(cacheKey, JSON.stringify(selected), {
				expirationTtl: 86400,
			});
			return selected;
		}
	} catch (error) {
		console.error(
			"[getDailyNews] Error accessing KV or generating news:",
			error,
		);
	}

	return null;
}
