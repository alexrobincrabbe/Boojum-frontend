import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If the data is FormData, remove Content-Type header to let axios set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens but don't force redirect
        // (user might be browsing as guest)
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/token/', { username, password });
    return response.data;
  },

  register: async (username: string, email: string, password: string, password2: string) => {
    const response = await api.post('/register/', {
      username,
      email,
      password,
      password2,
    });
    return response.data;
  },

  getUserInfo: async () => {
    const response = await api.get('/user/');
    return response.data;
  },

  updateUserActivity: async (location: string) => {
    const response = await api.post('/user/activity/', { location });
    return response.data;
  },

  getGoogleClientId: async () => {
    const response = await api.get('/google/client-id/');
    return response.data.client_id;
  },

  googleLogin: async (accessToken: string) => {
    const response = await api.post('/google/login/', { access_token: accessToken });
    return response.data;
  },

  googleCompleteRegistration: async (username: string, email: string, googleId: string, accessToken: string) => {
    const response = await api.post('/google/complete-registration/', {
      username,
      email,
      google_id: googleId,
      access_token: accessToken,
    });
    return response.data;
  },

  verifyEmail: async (key: string) => {
    const response = await api.get('/verify-email/', { params: { key } });
    return response.data;
  },

  requestPasswordReset: async (email: string) => {
    const response = await api.post('/password-reset/request/', { email });
    return response.data;
  },

  resetPassword: async (uidb64: string, token: string, newPassword: string, newPassword2: string) => {
    const response = await api.post('/password-reset/confirm/', {
      uidb64,
      token,
      new_password: newPassword,
      new_password2: newPassword2,
    });
    return response.data;
  },

  getProfile: async (profileUrl: string) => {
    const response = await api.get(`/profile/${profileUrl}/`);
    return response.data;
  },

  getHistoricalHighScores: async (profileUrl: string, period: 'weekly' | 'monthly' | 'yearly', includePositions: boolean = true) => {
    const response = await api.get(`/profile/${profileUrl}/historical-scores/`, {
      params: { period, positions: includePositions },
    });
    return response.data;
  },

  getProfileDoodles: async (profileUrl: string) => {
    const response = await api.get(`/profile/${profileUrl}/doodles/`);
    return response.data;
  },

  getDoodleAlbum: async (profileUrl: string, page: number = 1, pageSize: number = 3) => {
    const response = await api.get(`/profile/${profileUrl}/doodle-album/`, {
      params: { page, page_size: pageSize },
    });
    return response.data;
  },

  setDoodlePublic: async (doodleId: number, isPublic: boolean) => {
    const response = await api.post(`/doodles/${doodleId}/set-public/`, { public: isPublic });
    return response.data;
  },
  getDoodle: async (doodleId: number) => {
    const response = await api.get(`/doodles/${doodleId}/`);
    return response.data;
  },
  getDoodleByUrl: async (imageUrl: string) => {
    const response = await api.get(`/doodles/by-url/`, { params: { image_url: imageUrl } });
    return response.data;
  },
  getDoodleComments: async (doodleId: number) => {
    const response = await api.get(`/doodles/${doodleId}/comments/`);
    return response.data;
  },
  createDoodleComment: async (doodleId: number, commentText: string) => {
    const response = await api.post(`/doodles/${doodleId}/comments/`, { comment_text: commentText });
    return response.data;
  },
  replyToDoodleComment: async (commentId: number, replyText: string) => {
    const response = await api.post(`/doodles/comments/${commentId}/reply/`, { comment_text: replyText });
    return response.data;
  },
  deleteDoodleComment: async (commentId: number) => {
    const response = await api.delete(`/doodles/comments/${commentId}/`);
    return response.data;
  },
  getNotifications: async () => {
    const response = await api.get('/notifications/');
    return response.data;
  },
  markNotificationsRead: async () => {
    const response = await api.post('/notifications/mark-read/');
    return response.data;
  },

  updateProfile: async (profileData: FormData) => {
    const response = await api.put('/profile/update/', profileData);
    return response.data;
  },

  updateProfileSectionOrder: async (sectionOrder: string[]) => {
    const response = await api.post('/profile/section-order/', {
      section_order: sectionOrder,
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/token/refresh/', { refresh: refreshToken });
    return response.data;
  },
};

export const dashboardAPI = {
  getDashboardBundle: async () => {
    const response = await api.get('/dashboard/bundle/');
    return response.data;
  },
  getDashboardData: async () => {
    const response = await api.get('/dashboard/');
    return response.data;
  },
  updateEmail: async (email: string) => {
    const response = await api.post('/dashboard/email/', { email });
    return response.data;
  },
  updateDisplayName: async (displayName: string) => {
    const response = await api.post('/dashboard/display-name/', { display_name: displayName });
    return response.data;
  },
  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await api.post('/dashboard/password/', {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },
  updateChatSettings: async (chatColor: string, profanityFilter: boolean) => {
    const response = await api.post('/dashboard/chat-settings/', {
      chat_color: chatColor,
      profanity_filter: profanityFilter,
    });
    return response.data;
  },
  updatePlaymatesFilter: async (filterOnlinePlaymatesOnly: boolean) => {
    const response = await api.post('/dashboard/playmates-filter/', {
      filter_online_playmates_only: filterOnlinePlaymatesOnly,
    });
    return response.data;
  },
  searchUsers: async (query: string, includeBuddies: boolean = false) => {
    const response = await api.get('/dashboard/search-users/', {
      params: { q: query, include_buddies: includeBuddies },
    });
    return response.data;
  },
  addBuddy: async (buddyDisplayName: string) => {
    const response = await api.post('/dashboard/add-buddy/', {
      buddy: buddyDisplayName,
    });
    return response.data;
  },
  removeBuddy: async (buddyId: number) => {
    const response = await api.post('/dashboard/remove-buddy/', {
      buddy_id: buddyId,
    });
    return response.data;
  },
};

export const premiumAPI = {
  getPremiumStatus: async () => {
    const response = await api.get('/premium/status/');
    return response.data;
  },
  createSubscriptionCheckout: async () => {
    const response = await api.post('/premium/subscribe/');
    return response.data;
  },
  createDonationCheckout: async (amount: number) => {
    const response = await api.post('/premium/donate/', { amount });
    return response.data;
  },
  createCustomerPortal: async () => {
    const response = await api.post('/premium/portal/');
    return response.data;
  },
  getCustomRoom: async () => {
    const response = await api.get('/custom-room/');
    return response.data;
  },
  createOrUpdateCustomRoom: async (roomData: {
    name: string;
    timer: number;
    intermission: number;
    bonus: boolean;
    one_shot: boolean;
    word_level: number;
    language: string;
    use_special_boards: boolean;
    visibility: string;
    color: string;
    description?: string;
  }) => {
    const response = await api.post('/custom-room/create-or-update/', roomData);
    return response.data;
  },
};

export const lobbyAPI = {
  getLobbyData: async () => {
    const response = await api.get('/lobby/');
    return response.data;
  },
  getChatMessages: async () => {
    const response = await api.get('/lobby/chat/messages/');
    return response.data;
  },
  getLastMessageTimestamp: async () => {
    const response = await api.get('/lobby/chat/last-timestamp/');
    return response.data;
  },
  sendChatMessage: async (content: string) => {
    const response = await api.post('/lobby/chat/send/', { content });
    return response.data;
  },
  getRoomUsers: async () => {
    const response = await api.get('/lobby/chat/rooms/');
    return response.data;
  },
  getUsersOnline: async (filterPlaymatesOnly: string = 'false') => {
    const response = await api.get('/lobby/chat/users-online/', {
      params: { filter_playmates_only: filterPlaymatesOnly },
    });
    return response.data;
  },
  getNoUsersOnline: async () => {
    const response = await api.get('/lobby/chat/no-users-online/');
    return response.data;
  },
  checkNewActivities: async () => {
    const response = await api.get('/lobby/chat/check-new-activities/');
    return response.data;
  },
  markActivitiesSeen: async () => {
    const response = await api.post('/lobby/chat/mark-activities-seen/');
    return response.data;
  },
  votePoll: async (optionNo: number) => {
    const response = await api.post('/lobby/poll/vote/', { optionNo });
    return response.data;
  },
  getActivitiesFeed: async () => {
    const response = await api.get('/lobby/activities/');
    return response.data;
  },
  getDailyBoards: async () => {
    const response = await api.get('/daily-boards/');
    return response.data;
  },
  getDailyBoardsArchive: async (page: number = 1, perPage: number = 20) => {
    const response = await api.get('/daily-boards/archive/', {
      params: { page, per_page: perPage },
    });
    return response.data;
  },
  getDailyBoardArchiveDetail: async (boardId: number) => {
    const response = await api.get(`/daily-boards/archive/${boardId}/`);
    return response.data;
  },
  getTimelessBoards: async (level: number = 10) => {
    const response = await api.get(`/timeless-boards/`, { params: { level } });
    return response.data;
  },

  getTimelessBoardsAll: async (levels: number[] = [4, 7, 10]) => {
    const response = await api.get(`/timeless-boards/`, {
      params: { levels: levels.join(",") },
    });
    return response.data;
  },

  getTimelessBoardGame: async (timelessBoardId: number, level: number) => {
    const response = await api.get(`/timeless-boards/play/${timelessBoardId}/${level}/`);
    return response.data;
  },
  submitTimelessScore: async (timelessBoardId: number, level: number, scoreData: {
    score_percentage: number;
    which_words_found: string[];
    best_word: string;
  }) => {
    const response = await api.post(`/timeless-boards/submit/${timelessBoardId}/${level}/`, scoreData);
    return response.data;
  },
  useTimelessHint: async (timelessBoardId: number) => {
    const response = await api.post(`/timeless-boards/hint/${timelessBoardId}/`);
    return response.data;
  },
  getTimelessBoardsArchive: async (level: number = 10, page: number = 1, perPage: number = 20) => {
    const response = await api.get('/timeless-boards/archive/', {
      params: { level, page, per_page: perPage },
    });
    return response.data;
  },
  getTimelessBoardArchiveDetail: async (boardId: number, level: number) => {
    const response = await api.get(`/timeless-boards/archive/${boardId}/${level}/`);
    return response.data;
  },
  
  // Saved boards endpoints
  saveBoard: async (boardData: {
    board_letters: string[][];
    board_words: string[];
    bonus_letters: number[][];
    room_slug: string;
    score: number;
    timer: number;
    one_shot: boolean;
    best_word?: string;
    best_word_score?: number;
    number_of_words_found?: number;
    time?: number;
  }) => {
    const response = await api.post('/saved-boards/save/', boardData);
    return response.data;
  },
  
  getSavedBoards: async () => {
    const response = await api.get('/saved-boards/');
    return response.data;
  },
  
  deleteSavedBoard: async (boardId: number) => {
    const response = await api.delete(`/saved-boards/${boardId}/`);
    return response.data;
  },
  
  shareSavedBoard: async (boardId: number, username: string) => {
    const response = await api.post(`/saved-boards/${boardId}/share/`, { username });
    return response.data;
  },
  
  getSavedBoardGame: async (boardId: number) => {
    const response = await api.get(`/saved-boards/${boardId}/game/`);
    return response.data;
  },

  getSavedBoardScores: async (boardId: number) => {
    const response = await api.get(`/saved-boards/${boardId}/scores/`);
    return response.data;
  },
};

export const tournamentAPI = {
  getTournamentData: async (type: 'active' | 'test' = 'active', tournamentId?: number) => {
    const params: { type?: string; id?: number } = {};
    if (tournamentId) {
      params.id = tournamentId;
    } else {
      params.type = type;
    }
    const response = await api.get('/tournament/', { params });
    return response.data;
  },
  getTournamentList: async () => {
    const response = await api.get('/tournament/list/');
    return response.data;
  },
  register: async (tournamentType: 'active' | 'test' = 'active') => {
    // Use the API client which handles JWT authentication
    const response = await api.post('/tournament/tournament-registration/', {
      type: tournamentType,
    });
    return response.data;
  },
  unregister: async (tournamentType: 'active' | 'test' = 'active') => {
    // Use the API client which handles JWT authentication
    const response = await api.post('/tournament/tournament-unregistration/', {
      type: tournamentType,
    });
    return response.data;
  },
  getMatchDetails: async (matchId: number) => {
    const response = await api.get(`/tournament/match/${matchId}/`);
    return response.data;
  },
  getMatchInfo: async (matchId: number) => {
    const response = await api.get(`/tournament/match/${matchId}/info/`);
    return response.data;
  },
};

export const leaderboardsAPI = {
  getLeaderboards: async (gameType: string, period: string) => {
    const response = await api.get(`/leaderboards/${gameType}/${period}/`);
    return response.data;
  },
  getAllLeaderboards: async () => {
    const response = await api.get('/leaderboards/all/');
    return response.data;
  },
};

export const forumAPI = {
  getPosts: async (page: number = 1) => {
    const response = await api.get('/forum/posts/', { params: { page } });
    return response.data;
  },
  getPost: async (slug: string) => {
    const response = await api.get(`/forum/posts/${slug}/`);
    return response.data;
  },
  createPost: async (title: string, text: string) => {
    const response = await api.post('/forum/posts/create/', { title, text });
    return response.data;
  },
  updatePost: async (slug: string, title: string, text: string) => {
    const response = await api.put(`/forum/posts/${slug}/update/`, { title, text });
    return response.data;
  },
  createReply: async (postId: number, text: string) => {
    const response = await api.post(`/forum/posts/${postId}/replies/create/`, { text });
    return response.data;
  },
  updateReply: async (replyId: number, text: string) => {
    const response = await api.put(`/forum/replies/${replyId}/`, { text });
    return response.data;
  },
  deleteReply: async (replyId: number) => {
    const response = await api.delete(`/forum/replies/${replyId}/delete/`);
    return response.data;
  },
  markAllRead: async () => {
    const response = await api.post('/forum/mark-all-read/');
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await api.get('/forum/unread-count/');
    return response.data;
  },
  uploadImage: async (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const response = await api.post('/forum/upload-image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};


export const minigamesAPI = {
  getMinigamesArchive: async (date?: string) => {
    const url = date 
      ? `/minigames/archive/?date=${date}`
      : '/minigames/archive/';
    const response = await api.get(url);
    return response.data;
  },
  getMinigamesData: async () => {
    const response = await api.get('/minigames/');
    return response.data;
  },
  getDoodledumFeed: async () => {
    const response = await api.get('/minigames/doodledum/feed/');
    return response.data;
  },
  checkDoodledum: async () => {
    const response = await api.get('/minigames/doodledum/check/');
    return response.data;
  },
  fetchDoodledum: async (difficulty: string) => {
    const response = await api.get('/minigames/doodledum/fetch/', { params: { difficulty } });
    return response.data;
  },
  uploadDrawing: async (imageData: string) => {
    const response = await api.post('/minigames/doodledum/upload/', { image_data: imageData });
    return response.data;
  },
  cancelDrawing: async () => {
    const response = await api.post('/minigames/doodledum/cancel/');
    return response.data;
  },
  makeDoodledumGuess: async (guess: string) => {
    const response = await api.post('/minigames/doodledum/guess/', { guess });
    return response.data;
  },
  setCluejumAchievement: async (stage1: number, stage2: number, stage3: number) => {
    const response = await api.post('/minigames/cluejum/achievement/', { stage1, stage2, stage3 });
    return response.data;
  },
  setBoojumbleAchievement: async (level: string) => {
    const response = await api.post('/minigames/boojumble/achievement/', { boojumble_level: level });
    return response.data;
  },
};

export default api;

