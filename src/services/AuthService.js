import apiClient, { APIError } from './api-client';

const TOKEN_KEY = 'shroomsync_token';
const USER_KEY = 'shroomsync_user';

class AuthService {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('[AuthService] Failed to persist token:', e);
    }
  }

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('[AuthService] Failed to clear token:', e);
    }
  }

  getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.error('[AuthService] Failed to persist user:', e);
    }
  }

  clearUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('[AuthService] Failed to clear user:', e);
    }
  }

  isAuthenticated() {
    return Boolean(this.getToken());
  }

  logout() {
    this.clearToken();
    this.clearUser();
  }

  /**
   * POST /api/v1/auth/login
   * @param {Object} credentials - { identifier, password }
   */
  async login({ identifier, password }) {
    if (!identifier || !password) {
      throw new APIError('Username/email dan password wajib diisi.', 400);
    }

    const payload = await apiClient.post('/auth/login', {
      identifier: identifier.trim(),
      password,
    });

    const data = payload?.data || payload;
    if (data?.token) {
      this.setToken(data.token);
    }

    const userProfile = {
      ...(data?.user || {}),
      mustSetupProfile: Boolean(data?.mustSetupProfile),
      nextStep: data?.nextStep || (data?.mustSetupProfile ? 'complete_profile' : 'dashboard'),
    };

    this.setUser(userProfile);

    return {
      token: data?.token,
      user: userProfile,
      mustSetupProfile: Boolean(data?.mustSetupProfile),
      nextStep: data?.nextStep,
      message: payload?.message,
    };
  }

  /**
   * POST /api/v1/auth/complete-onboarding
   * @param {Object} onboardingData - { currentPassword, newPassword, fullName, phoneNumber, farmName, farmAddress }
   */
  async completeOnboarding({ currentPassword, newPassword, fullName, phoneNumber, farmName, farmAddress }) {
    if (!currentPassword || !newPassword) {
      throw new APIError('Password lama dan password baru wajib diisi.', 400);
    }
    if (!fullName) {
      throw new APIError('Nama lengkap wajib diisi.', 400);
    }

    const payload = await apiClient.post('/auth/complete-onboarding', {
      currentPassword,
      newPassword,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      farmName: farmName ? farmName.trim() : '',
      farmAddress: farmAddress ? farmAddress.trim() : '',
    });

    const data = payload?.data || payload;
    if (data?.token) {
      this.setToken(data.token);
    }

    const userProfile = {
      ...(data?.user || {}),
      mustSetupProfile: false,
      nextStep: 'dashboard',
    };

    this.setUser(userProfile);

    return {
      token: data?.token,
      user: userProfile,
      mustSetupProfile: false,
      nextStep: 'dashboard',
      message: payload?.message,
    };
  }

  /**
   * GET /api/v1/auth/me
   */
  async getMe() {
    const payload = await apiClient.get('/auth/me');
    const data = payload?.data || payload;

    const userProfile = {
      ...(data?.user || {}),
      deviceCount: data?.deviceCount ?? 0,
      mustSetupProfile: Boolean(data?.mustSetupProfile),
      nextStep: data?.nextStep || 'dashboard',
    };

    this.setUser(userProfile);
    return userProfile;
  }

  /**
   * POST /api/v1/auth/register-farmer
   * (Admin or initial onboarding)
   */
  async registerFarmer(farmerData) {
    return apiClient.post('/auth/register-farmer', farmerData);
  }
}

export default new AuthService();
export { AuthService };

