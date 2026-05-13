import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

export function getGithubApp(env: Record<string, string | undefined>) {
	return new App({
		appId: env.GITHUB_APP_ID || "",
		privateKey: env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
		Octokit: Octokit,
	});
}

export async function getPullRequest(
	env: Record<string, string | undefined>,
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

export async function getPullRequestDiff(
	env: Record<string, string | undefined>,
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

export async function getIssueComments(
	env: Record<string, string | undefined>,
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

export async function getReviewComments(
	env: Record<string, string | undefined>,
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

export async function createPlaceholderComment(
	env: Record<string, string | undefined>,
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

export async function updateComment(
	env: Record<string, string | undefined>,
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

export async function createReviewComment(
	env: Record<string, string | undefined>,
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

export async function createReview(
	env: Record<string, string | undefined>,
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

export async function deleteComment(
	env: Record<string, string | undefined>,
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

export async function getReviewThreads(
	env: Record<string, string | undefined>,
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
					reviewThreads(first: 100) {
						nodes {
							id
							isResolved
							path
							line
							comments(first: 50) {
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
	const result = await octokit.graphql<any>(query, {
		owner,
		repo,
		pullNumber,
	});
	return result.repository.pullRequest.reviewThreads.nodes;
}

export async function resolveReviewThread(
	env: Record<string, string | undefined>,
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

export async function createReplyForReviewComment(
	env: Record<string, string | undefined>,
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
