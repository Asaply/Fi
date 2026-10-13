// Free trial for new subscribers. Anyone who ever had a subscription row pays
// from day one, so cancelling and re-subscribing doesn't grant another trial.
export const TRIAL_DAYS = 7;

export function trialDaysFor(priorSubscription) {
    return priorSubscription ? 0 : TRIAL_DAYS;
}
