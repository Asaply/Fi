// Onboarding step numbers and where a returning user picks up. Plans come
// before Import so no statement is analyzed (with paid AI) before the user
// starts the trial.
import { userHasAccess } from './access';

export const STEP = { START: 0, SECURITY: 5, PLANS: 6, IMPORT: 7, INSIGHTS: 8, DONE: 9 };

// Web checkout leaves the app; when Stripe sends the user back they land here
// again, as does anyone who closed the app on the plans screen.
export function onboardingStartStep(user, now = Date.now()) {
    if (userHasAccess(user, now)) return STEP.IMPORT;
    if (user?.user_metadata?.display_name) return STEP.PLANS;
    return STEP.START;
}
