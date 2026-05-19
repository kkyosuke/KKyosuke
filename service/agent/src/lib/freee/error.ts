export interface FreeeErrorData {
	status_code?: number;
	errors?: {
		type?: string;
		messages?: string[];
	}[];
}

export class FreeeAPIError extends Error {
	public errorData?: FreeeErrorData;

	constructor(
		message: string,
		public status: number,
		public statusText: string,
		public responseBody: string,
	) {
		super(message);
		this.name = "FreeeAPIError";

		try {
			this.errorData = JSON.parse(responseBody) as FreeeErrorData;
		} catch {
			console.warn(
				"Failed to parse freee API error response as JSON:",
				responseBody,
			);
		}

		// maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FreeeAPIError);
		}
	}
}
