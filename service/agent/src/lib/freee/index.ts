import { buildAuthFunction } from "./auth";
import {
	getApprovalFlows,
	getAvailableTimeClockTypes,
	getMe,
	getTimeClocks,
	postPaidHolidayRequest,
	postTimeClock,
} from "./hr";

export interface FreeeConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export function createFreeeClient(config: FreeeConfig) {
	const freee = {
		...buildAuthFunction(config),
		hr: {
			getMe,
			postTimeClock,
			getAvailableTimeClockTypes,
			getTimeClocks,
			getApprovalFlows,
			postPaidHolidayRequest,
		},
	};
	return freee;
}
