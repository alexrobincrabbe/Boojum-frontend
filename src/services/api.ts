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

  getProfile: async (profileUrl: string) => {
    const response = await api.get(`/profile/${profileUrl}/`);
    return response.data;
  },

  updateProfile: async (profileData: FormData) => {
    const response = await api.put('/profile/update/', profileData);
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
  searchUsers: async (query: string) => {
    const response = await api.get('/dashboard/search-users/', {
      params: { q: query },
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
  getUsersOnline: async () => {
    const response = await api.get('/lobby/chat/users-online/');
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

