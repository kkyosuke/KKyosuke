import { FreeeAPIError } from "../../../lib/freee/error";

/**
 * freeeのエラーからSlack表示用のメッセージを抽出します。
 */
export function getFreeeErrorMessage(e: unknown): string {
	if (e instanceof FreeeAPIError) {
		if (e.errorData?.errors && Array.isArray(e.errorData.errors)) {
			const messages = e.errorData.errors.flatMap((err) => err.messages || []);
			if (messages.length > 0) {
				return messages.join("\n");
			}
		}
		return `${e.message} (${e.status} ${e.statusText})`;
	}
	if (e instanceof Error) {
		return e.message;
	}
	return String(e);
}
