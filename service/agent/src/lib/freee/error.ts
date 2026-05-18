export class FreeeAPIError extends Error {
	constructor(
		message: string,
		public status: number,
		public statusText: string,
		public responseBody: string,
	) {
		super(message);
		this.name = "FreeeAPIError";

		// maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FreeeAPIError);
		}
	}
}
