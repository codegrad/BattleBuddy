// The single source of truth for "which physical direction goes where" —
// shared by the hub's full-screen swipe gesture and the BB joystick overlay
// so a drag and a d-pad tap in the same direction always agree.
export type Direction = 'up' | 'down' | 'left' | 'right';

// Both vertical directions land on the One Conversation surface — voice is
// the dock's speaker tap there, not a separate screen (and audio never
// auto-enables, so a "voice" route that pre-arms the mic can't exist).
export const NAV_ROUTES: Record<Direction, string> = {
  down: '/session',
  up: '/session',
  left: '/content-feed',
  right: '/profile',
};

export const NAV_LABELS: Record<Direction, string> = {
  down: 'Buddy',
  up: 'Buddy',
  left: 'Content',
  right: 'Profile',
};
