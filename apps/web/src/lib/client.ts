import { hc } from "hono/client";
import type { AppType } from "../../../server/src/index";

// biome-ignore lint/suspicious/noExplicitAny: Hono client types can be complex
export const client = hc<AppType>("/") as any;
