import type { UserPreferences } from "@superbhuman/shared";

import type { GmailDomAdapter } from "../gmail/domAdapter";

export function shouldShowOnboarding(preferences: UserPreferences): boolean {
  return !preferences.onboardingCompleted;
}

export async function enableKeyboardShortcuts(adapter: GmailDomAdapter): Promise<boolean> {
  return adapter.attemptEnableKeyboardShortcuts();
}
