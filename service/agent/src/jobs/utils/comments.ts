import { createReviewComment } from "../../lib/github";

/**
 * インラインコメントをGitHub PRに投稿します。
 *
 * @param env - 環境変数
 * @param installationId - インストールID
 * @param owner - オーナー名
 * @param repo - リポジトリ名
 * @param pullNumber - PR番号
 * @param sha - コミットSHA
 * @param feedbacks - 投稿するフィードバックのリスト
 * @param prefixMessage - コメントタイトルに追加するプレフィックス
 */
export async function postInlineComments(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	sha: string,
	feedbacks: Array<{
		path?: string;
		line: number;
		severity: string;
		summary: string;
		reason: string;
	}>,
	prefixMessage: string = "",
) {
	for (const item of feedbacks) {
		if (item.path && item.path !== "-" && item.line > 0) {
			try {
				const title = prefixMessage
					? `**${item.severity} (${prefixMessage})**`
					: `**${item.severity}**`;
				await createReviewComment(
					env,
					installationId,
					owner,
					repo,
					pullNumber,
					sha,
					item.path,
					item.line,
					`${title}\n\n**概要:** ${item.summary}\n\n**指摘理由:** ${item.reason}`,
				);
				console.log(
					`[InlineComment] Created inline comment for ${item.path}:${item.line}`,
				);
				// API制限を回避するために待機
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (err: unknown) {
				console.error(
					`[InlineComment] Failed to create inline comment for ${item.path}:${item.line}:`,
					err instanceof Error ? err.message : String(err),
				);
			}
		}
	}
}
