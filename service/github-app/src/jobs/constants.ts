import pkg from "../../package.json" with { type: "json" };

export const IN_PROGRESS_PLACEHOLDER_COMMENT = `> [!NOTE]\n> 🔍 **Review in Progress**\n> 現在コードのレビュー中です。完了まで少々お待ちください！\n> version: ${pkg.version}`;

export const MAX_REVIEW_THREADS = 100;
export const MAX_COMMENTS_PER_THREAD = 50;
