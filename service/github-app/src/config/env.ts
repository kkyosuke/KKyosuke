export function getBotName(env: Record<string, string | undefined>): string {
	// Cloudflare Workers環境では process グローバル変数が存在しない可能性があるため、
	// 参照エラーを防ぐ目的で typeof process !== "undefined" を確認しています。
	const isLocal =
		typeof process !== "undefined" && process.env.NODE_ENV !== "production";
	return env.BOT_NAME || (isLocal ? "test.kkyosuke.ai" : "kkyosuke.ai");
}
