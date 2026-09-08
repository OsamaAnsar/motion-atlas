import { config } from "@/lib/config";
import type { GenerationProvider } from "@/lib/provider/types";
import { getMockProvider } from "@/lib/provider/mock/mock-provider";
import { ApiProvider } from "@/lib/provider/api-provider";

let apiSingleton: ApiProvider | null = null;

/**
 * The one entry point the UI uses. `NEXT_PUBLIC_DEMO_MODE` decides which
 * implementation backs every generation call.
 */
export function getProvider(): GenerationProvider {
  if (config.demoMode) return getMockProvider();
  if (!apiSingleton) apiSingleton = new ApiProvider();
  return apiSingleton;
}

export { type GenerationProvider } from "@/lib/provider/types";
