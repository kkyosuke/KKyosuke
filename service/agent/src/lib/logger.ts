import type { CustomAppEnv } from "../config/env";
import { SettingsManager } from "../config/settings";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

class Logger {
	private moduleName?: string;
	private logLevel: LogLevel;

	constructor(moduleName?: string, logLevel: LogLevel = "info") {
		this.moduleName = moduleName;
		this.logLevel = logLevel;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel];
	}

	private formatMessage(level: LogLevel, message: string, meta?: unknown) {
		const timestamp = new Date().toISOString();
		const prefix = this.moduleName ? `[${this.moduleName}] ` : "";

		let metaString = "";
		if (meta !== undefined) {
			if (meta instanceof Error) {
				metaString = `\n${meta.stack || meta.message}`;
			} else if (typeof meta === "object") {
				try {
					metaString = ` ${JSON.stringify(meta)}`;
				} catch (_e) {
					metaString = " [Unserializable Meta]";
				}
			} else {
				metaString = ` ${String(meta)}`;
			}
		}

		return `${timestamp} [${level.toUpperCase()}] ${prefix}${message}${metaString}`;
	}

	info(message: string, meta?: unknown) {
		if (!this.shouldLog("info")) return;
		console.log(this.formatMessage("info", message, meta));
	}

	error(message: string, error?: unknown) {
		if (!this.shouldLog("error")) return;
		console.error(this.formatMessage("error", message, error));
	}

	warn(message: string, meta?: unknown) {
		if (!this.shouldLog("warn")) return;
		console.warn(this.formatMessage("warn", message, meta));
	}

	debug(message: string, meta?: unknown) {
		if (!this.shouldLog("debug")) return;
		console.debug(this.formatMessage("debug", message, meta));
	}
}

export const createLogger = async (
	moduleName: string,
	env?: Partial<CustomAppEnv>,
) => {
	let logLevel: LogLevel = "info";
	if (env) {
		const settings = new SettingsManager(env);
		const levelStr = (await settings.getLogLevel()).toLowerCase() as LogLevel;
		if (levelStr && levelStr in LOG_LEVELS) {
			logLevel = levelStr;
		}
	}
	return new Logger(moduleName, logLevel);
};
