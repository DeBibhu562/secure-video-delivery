export interface Video {
  id: string;
  /** Plans that unlock this video. Empty = free. */
  requiredPlans: string[];
  /** Position inside its module; lessons unlock in order. */
  order: number;
  /** Max times a paid user may watch it. Undefined = unlimited. */
  maxWatches?: number;
}

export interface Viewer {
  activePlans: string[];
  /** Highest lesson order the viewer has completed in this module. */
  completedUpTo: number;
  /** How many times the viewer has already watched this video. */
  watchCount: number;
}

export type AccessDecision =
  | { allowed: true; remainingWatches?: number }
  | { allowed: false; reason: 'no_plan' | 'locked' | 'watch_limit' };

/**
 * Decides access before any token is signed. The stream URL never leaves the server
 * for a viewer who fails this check, so there is nothing to copy.
 */
export function checkAccess(video: Video, viewer: Viewer): AccessDecision {
  if (video.requiredPlans.length === 0) return { allowed: true };
  if (!video.requiredPlans.some((p) => viewer.activePlans.includes(p))) return { allowed: false, reason: 'no_plan' };
  if (video.order > viewer.completedUpTo + 1) return { allowed: false, reason: 'locked' };
  if (video.maxWatches !== undefined) {
    const remaining = video.maxWatches - viewer.watchCount;
    if (remaining <= 0) return { allowed: false, reason: 'watch_limit' };
    return { allowed: true, remainingWatches: remaining };
  }
  return { allowed: true };
}
