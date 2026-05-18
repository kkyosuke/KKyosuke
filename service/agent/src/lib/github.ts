import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import type { CustomAppEnv } from "../config/env";
import { getBotName } from "../config/env";
import {
	MAX_COMMENTS_PER_THREAD,
	MAX_REVIEW_THREADS,
} from "../jobs/github/constants";

export interface ReviewThread {
	id: string;
	isResolved: boolean;
	path: string;
	line: number;
	comments: {
		nodes: Array<{
			id: string;
			databaseId: number;
			body: string;
			author?: { login?: string };
		}>;
	};
}

/**
 * GitHub Appのインスタンスを取得します。
 */
export function getGithubApp(env: Partial<CustomAppEnv>) {
	return new App({
		appId: env.GITHUB_APP_ID || "",
		privateKey: env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
		Octokit: Octokit,
	});
}

/**
 * PRの詳細情報を取得します。
 */
export async function getPullRequest(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: pullNumber,
	});
	return data;
}

/**
 * PRの差分(diff)を取得します。
 */
export async function getPullRequestDiff(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: pullNumber,
		mediaType: {
			format: "diff",
		},
	});
	return data as unknown as string;
}

/**
 * Issue（PR）のコメント一覧を取得します。
 */
export async function getIssueComments(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	issueNumber: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.listComments({
		owner,
		repo,
		issue_number: issueNumber,
	});
	return data;
}

/**
 * PRのレビューコメント一覧を取得します。
 */
export async function getReviewComments(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.listReviewComments({
		owner,
		repo,
		pull_number: pullNumber,
	});
	return data;
}

/**
 * 進捗状況などを表示するためのプレースホルダーコメントを作成します。
 */
export async function createPlaceholderComment(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	issueNumber: number,
	body: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: issueNumber,
		body,
	});
	return data;
}

/**
 * 既存のコメントを更新します。
 */
export async function updateComment(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	commentId: number,
	body: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.updateComment({
		owner,
		repo,
		comment_id: commentId,
		body,
	});
	return data;
}

/**
 * 既存のレビュー（サマリ）を更新します。
 */
export async function updateReview(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	reviewId: number,
	body: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.updateReview({
		owner,
		repo,
		pull_number: pullNumber,
		review_id: reviewId,
		body,
	});
	return data;
}

/**
 * コードの特定の行に対するインラインコメント（レビューコメント）を作成します。
 */
export async function createReviewComment(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	commitId: string,
	path: string,
	line: number,
	body: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.createReviewComment({
		owner,
		repo,
		pull_number: pullNumber,
		commit_id: commitId,
		path,
		line,
		body,
	});
	return data;
}

/**
 * PRに対する全体レビュー（APPROVE, REQUEST_CHANGES等）を作成します。
 */
export async function createReview(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	body: string,
	event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.createReview({
		owner,
		repo,
		pull_number: pullNumber,
		body,
		event,
	});
	return data;
}

/**
 * コメントを削除します。
 */
export async function deleteComment(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	commentId: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.deleteComment({
		owner,
		repo,
		comment_id: commentId,
	});
	return data;
}

/**
 * PRのレビュースレッド一覧を取得します（ボットが作成したもののみ）。
 */
export async function getReviewThreads(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const query = `
		query($owner: String!, $repo: String!, $pullNumber: Int!) {
			repository(owner: $owner, name: $repo) {
				pullRequest(number: $pullNumber) {
					reviewThreads(first: ${MAX_REVIEW_THREADS}) {
						nodes {
							id
							isResolved
							path
							line
							comments(first: ${MAX_COMMENTS_PER_THREAD}) {
								nodes {
									id
									databaseId
									body
									author { login }
								}
							}
						}
					}
				}
			}
		}
	`;
	const result = await octokit.graphql<{
		repository: {
			pullRequest: { reviewThreads: { nodes: ReviewThread[] } };
		};
	}>(query, {
		owner,
		repo,
		pullNumber,
	});
	const nodes = result.repository.pullRequest.reviewThreads.nodes;
	const botName = getBotName(env);

	return nodes.filter((thread) => {
		const firstComment = thread.comments?.nodes?.[0];
		if (!firstComment) return false;
		const authorLogin = firstComment.author?.login || "";
		return authorLogin === botName || authorLogin === `${botName}[bot]`;
	});
}

/**
 * レビュースレッドを解決済み（Resolved）にします。
 */
export async function resolveReviewThread(
	env: Partial<CustomAppEnv>,
	installationId: number,
	threadId: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const mutation = `
		mutation($threadId: ID!) {
			resolveReviewThread(input: {threadId: $threadId}) {
				thread { isResolved }
			}
		}
	`;
	await octokit.graphql(mutation, { threadId });
}

/**
 * 既存のレビューコメントに対して返信を作成します。
 */
export async function createReplyForReviewComment(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	commentId: number,
	body: string,
) {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.createReplyForReviewComment({
		owner,
		repo,
		pull_number: pullNumber,
		comment_id: commentId,
		body,
	});
	return data;
}

/**
 * リポジトリ内の特定ファイルの内容を取得します。
 */
export async function getRepositoryFile(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	path: string,
	ref?: string,
): Promise<string | null> {
	const app = getGithubApp(env);
	const octokit = await app.getInstallationOctokit(installationId);
	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref,
			mediaType: {
				format: "raw",
			},
		});
		return data as unknown as string;
	} catch (e: unknown) {
		if (e && typeof e === "object" && "status" in e && e.status === 404) {
			return null; // ファイルが存在しない場合はnullを返す
		}
		throw e;
	}
}
