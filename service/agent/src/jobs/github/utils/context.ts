import { REPOSITORY_GUIDELINES_PATH } from "../../../config";
import {
	getPullRequest,
	getPullRequestDiff,
	getRepositoryFile,
} from "../../../lib/github";

/**
 * PRの情報や差分、ガイドラインを取得します。
 */
export async function fetchReviewContext(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	const [pr, diff] = await Promise.all([
		getPullRequest(env, installationId, owner, repo, pullNumber),
		getPullRequestDiff(env, installationId, owner, repo, pullNumber),
	]);

	const guidelines = await getRepositoryFile(
		env,
		installationId,
		owner,
		repo,
		REPOSITORY_GUIDELINES_PATH,
		pr.head?.sha,
	);

	return { pr, diff, guidelines };
}

/**
 * 基本の指示にガイドラインを結合して返します。
 */
export function buildInstructionWithGuidelines(
	baseInstruction: string,
	guidelines: string | null | undefined,
	customIntro: string = "以下のルールを必ず守って対応してください：",
) {
	let finalInstruction = baseInstruction;
	if (guidelines) {
		finalInstruction += `\n\n## リポジトリ固有のガイドライン\n${customIntro}\n\n${guidelines}`;
	}
	return finalInstruction;
}
