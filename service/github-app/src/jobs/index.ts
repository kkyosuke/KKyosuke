export * from "./re-review";
export * from "./reply";
export * from "./review";
export * from "./types";

import { reReviewCommand } from "./re-review";
import { replyCommand } from "./reply";
import { reviewCommand } from "./review";
import type { CommandJob } from "./types";

/**
 * 利用可能なコマンドのリスト
 */
export const availableCommands: CommandJob[] = [
	reviewCommand,
	reReviewCommand,
	replyCommand,
];
