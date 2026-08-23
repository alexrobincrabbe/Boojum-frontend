/** Leaderboard URLs for crown jewels (last-week tops). */
export const CROWN_JEWEL_LINKS: Record<string, string> = {
  lookingglass: '/leaderboards?gameType=normal&period=last-week',
  boojum: '/leaderboards?gameType=bonus&period=last-week',
  forevermore: '/leaderboards?gameType=long_game&period=last-week',
  points: '/points?period=weekly',
};

/** Leaderboard URLs for frame jewels (all-time tops). */
export const SCEPTRE_JEWEL_LINKS: Record<string, string> = {
  lookingglass: '/leaderboards?gameType=normal&period=all-time',
  boojum: '/leaderboards?gameType=bonus&period=all-time',
  forevermore: '/leaderboards?gameType=long_game&period=all-time',
  points: '/points?period=all-time',
};

export const BADGE_JEWEL_LABELS: Record<string, string> = {
  lookingglass: 'Looking Glass leaderboard',
  boojum: 'Boojum leaderboard',
  forevermore: 'Forevermore leaderboard',
  points: 'Points leaderboard',
};

export const POINTS_STAR_LINK = '/points?period=all-time';
