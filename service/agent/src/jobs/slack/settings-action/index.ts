import type { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { SettingsManager } from "../../../config/settings";

type ActionHandlerArgs = Parameters<SlackApp<CustomAppEnv>["action"]>;
type AckFn = ActionHandlerArgs[1];

export const handleModelChange: AckFn = async (req) => {
	const payload = req.payload as {
		actions?: Array<{ selected_option?: { value: string } }>;
		user?: { id: string };
	};
	const selectedModel = payload.actions?.[0]?.selected_option?.value;
	if (selectedModel) {
		const settings = new SettingsManager(req.env);
		await settings.setReviewModel(selectedModel);
	}
	return "";
};

export const handleReportModelChange: AckFn = async (req) => {
	const payload = req.payload as {
		actions?: Array<{ selected_option?: { value: string } }>;
		user?: { id: string };
	};
	const selectedModel = payload.actions?.[0]?.selected_option?.value;
	if (selectedModel) {
		const settings = new SettingsManager(req.env);
		await settings.setReportModel(selectedModel);
	}
	return "";
};

export const handleAutoReviewEnabledChange: AckFn = async (req) => {
	const payload = req.payload as {
		actions?: Array<{ selected_options?: Array<{ value: string }> }>;
		user?: { id: string };
	};
	const selectedOptions = payload.actions?.[0]?.selected_options || [];
	const isEnabled = selectedOptions.some((opt) => opt.value === "enabled");

	const settings = new SettingsManager(req.env);
	await settings.setAutoReviewEnabled(isEnabled);
	return "";
};

export const handleLogLevelChange: AckFn = async (req) => {
	const payload = req.payload as {
		actions?: Array<{ selected_option?: { value: string } }>;
		user?: { id: string };
	};
	const selectedLogLevel = payload.actions?.[0]?.selected_option?.value;
	if (selectedLogLevel) {
		const settings = new SettingsManager(req.env);
		await settings.setLogLevel(selectedLogLevel);
	}
	return "";
};
