import { FreeeAPIError } from "../../../lib/freee/error";

/**
 * freeeのエラーからSlack表示用のメッセージを抽出します。
 */
export function getFreeeErrorMessage(e: unknown): string {
	if (e instanceof FreeeAPIError) {
		return `${e.message} (${e.status} ${e.statusText})`;
	}
	if (e instanceof Error) {
		return e.message;
	}
	return String(e);
}
