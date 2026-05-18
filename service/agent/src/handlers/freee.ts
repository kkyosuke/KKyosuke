import { Hono } from "hono";
import {
	handleFreeeAuthCallback,
	handleFreeeAuthRedirect,
	handleFreeeAuthStart,
} from "../jobs/freee/auth";

export const freeeApp = new Hono<{
	Bindings: import("../config/env").CustomAppEnv;
}>();

freeeApp.get("/auth/start", handleFreeeAuthStart);
freeeApp.get("/auth", handleFreeeAuthRedirect);
freeeApp.get("/auth/callback", handleFreeeAuthCallback);
