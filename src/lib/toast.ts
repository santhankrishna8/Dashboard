/** One line of feedback at the bottom of the screen. Fire from anywhere; <Toasts /> in App shows it. */
export const toast = (message: string) => window.dispatchEvent(new CustomEvent("sd:toast", { detail: message }));
