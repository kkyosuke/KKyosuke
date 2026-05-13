export * from "./review";
export * from "./re-review";
export * from "./types";

import { reviewCommand } from "./review";
import { reReviewCommand } from "./re-review";
import type { CommandJob } from "./types";

// 登録されている全てのコマンドのリスト
export const availableCommands: CommandJob[] = [reviewCommand, reReviewCommand];
