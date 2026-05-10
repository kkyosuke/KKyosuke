import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { env } from "../config/env";

export const app = new App({
	appId: env.GITHUB_APP_ID,
	privateKey: env.GITHUB_PRIVATE_KEY,
	Octokit: Octokit,
});

export async function getPullRequest(installationId: number, owner: string, repo: string, pullNumber: number) {
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: pullNumber,
	});
	return data;
}

export async function getPullRequestDiff(installationId: number, owner: string, repo: string, pullNumber: number) {
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

export async function getIssueComments(installationId: number, owner: string, repo: string, issueNumber: number) {
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.listComments({
		owner,
		repo,
		issue_number: issueNumber,
	});
	return data;
}

export async function createPlaceholderComment(installationId: number, owner: string, repo: string, issueNumber: number, body: string) {
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: issueNumber,
		body,
	});
	return data;
}

export async function updateComment(installationId: number, owner: string, repo: string, commentId: number, body: string) {
	const octokit = await app.getInstallationOctokit(installationId);
	const { data } = await octokit.rest.issues.updateComment({
		owner,
		repo,
		comment_id: commentId,
		body,
	});
	return data;
}
