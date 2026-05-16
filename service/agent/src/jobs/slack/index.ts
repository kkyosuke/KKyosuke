import { summaryMentionCommand } from "./save-summary";
import { weeklyReportMentionCommand } from "./weekly-report";
import type { SlackMentionCommand } from "./types";

export const availableCommands: SlackMentionCommand[] = [
	summaryMentionCommand,
	weeklyReportMentionCommand,
];

export * from "./app-home";
export * from "./hey-cf-workers";
export * from "./router";
export * from "./save-summary";
export * from "./weekly-report";
export * from "./types";
