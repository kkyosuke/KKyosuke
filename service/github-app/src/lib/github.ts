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
