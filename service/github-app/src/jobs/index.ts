export * from "./re-review";
export * from "./review";
export * from "./types";

import { reReviewCommand } from "./re-review";
import { reviewCommand } from "./review";
import type { CommandJob } from "./types";

// 登録されている全てのコマンドのリスト
export const availableCommands: CommandJob[] = [reviewCommand, reReviewCommand];
