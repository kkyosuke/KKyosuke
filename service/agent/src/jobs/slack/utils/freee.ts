/**
 * freeeのAPIエラーメッセージから、Slackで安全に表示できる短いメッセージを抽出します。
 * (例: <!DOCTYPE html> などの余分なHTMLタグや改行を排除します)
 */
export function formatFreeeErrorForSlack(e: unknown): string {
	const err = e instanceof Error ? e : new Error(String(e));
	const safeMessage = (
		(err.message.split("\n")[0] || "").split(" - <")[0] || ""
	).substring(0, 150);
	return safeMessage;
}
