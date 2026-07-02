// The single source of truth for "which physical direction goes where" —
// shared by the hub's full-screen swipe gesture and the BB joystick overlay
// so a drag and a d-pad tap in the same direction always agree.
export type Direction = 'up' | 'down' | 'left' | 'right';

export const NAV_ROUTES: Record<Direction, string> = {
  up: '/session-voice',
  right: '/(app)/content-feed',
  down: '/(app)/session-chat',
  left: '/(app)/profile',
};

export const NAV_LABELS: Record<Direction, string> = {
  up: 'Voice',
  right: 'Content',
  down: 'Chat',
  left: 'Profile',
};
