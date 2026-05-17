type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
	private moduleName?: string;

	constructor(moduleName?: string) {
		this.moduleName = moduleName;
	}

	private formatMessage(level: LogLevel, message: string, meta?: any) {
		const timestamp = new Date().toISOString();
		const prefix = this.moduleName ? `[${this.moduleName}] ` : "";

		let metaString = "";
		if (meta !== undefined) {
			if (meta instanceof Error) {
				metaString = `\n${meta.stack || meta.message}`;
			} else if (typeof meta === "object") {
				try {
					metaString = ` ${JSON.stringify(meta)}`;
				} catch (e) {
					metaString = " [Unserializable Meta]";
				}
			} else {
				metaString = ` ${String(meta)}`;
			}
		}

		return `${timestamp} [${level.toUpperCase()}] ${prefix}${message}${metaString}`;
	}

	info(message: string, meta?: any) {
		console.log(this.formatMessage("info", message, meta));
	}

	error(message: string, error?: any) {
		console.error(this.formatMessage("error", message, error));
	}

	warn(message: string, meta?: any) {
		console.warn(this.formatMessage("warn", message, meta));
	}

	debug(message: string, meta?: any) {
		console.debug(this.formatMessage("debug", message, meta));
	}
}

export const createLogger = (moduleName: string) => new Logger(moduleName);
