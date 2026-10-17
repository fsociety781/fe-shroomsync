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
    try {
      localStorage.removeItem('shroomsync_active_page');
    } catch {
      // ignore
    }
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
    const token = data?.token || payload?.token;
    if (token) {
      this.setToken(token);
    }

    const existingUser = this.getUser() || {};
    const rawUser = data?.user || (data?.role || data?.username || data?.id ? data : null) || payload?.user || {};
    const detectedRole = (rawUser.role || data?.role || payload?.role || existingUser.role || 'FARMER').toUpperCase();

    const userProfile = {
      ...existingUser,
      ...rawUser,
      role: detectedRole,
      mustSetupProfile: Boolean(data?.mustSetupProfile ?? rawUser.mustSetupProfile ?? existingUser.mustSetupProfile),
      nextStep: data?.nextStep || rawUser.nextStep || (data?.mustSetupProfile ? 'complete_profile' : 'dashboard'),
    };

    this.setUser(userProfile);

    // Otomatis simpan preferensi halaman utama role di storage
    try {
      if (detectedRole === 'TECHNICIAN') {
        localStorage.setItem('shroomsync_active_page', 'technician');
      } else if (detectedRole === 'ADMIN') {
        localStorage.setItem('shroomsync_active_page', 'admin');
      } else {
        localStorage.setItem('shroomsync_active_page', 'dashboard');
      }
    } catch {
      // ignore
    }

    return {
      token,
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

    const existingUser = this.getUser() || {};
    const rawUser = data?.user || (data?.role || data?.username || data?.id ? data : null) || payload?.user || {};
    const detectedRole = (rawUser.role || data?.role || existingUser.role || 'FARMER').toUpperCase();

    const userProfile = {
      ...existingUser,
      ...rawUser,
      role: detectedRole,
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

    const existingUser = this.getUser() || {};
    const rawUser = data?.user || (data?.role || data?.username || data?.id ? data : null) || payload?.user || {};
    const detectedRole = (rawUser.role || data?.role || payload?.role || existingUser.role || 'FARMER').toUpperCase();

    const userProfile = {
      ...existingUser,
      ...rawUser,
      role: detectedRole,
      deviceCount: data?.deviceCount ?? rawUser.deviceCount ?? existingUser.deviceCount ?? 0,
      mustSetupProfile: Boolean(data?.mustSetupProfile ?? rawUser.mustSetupProfile ?? existingUser.mustSetupProfile),
      nextStep: data?.nextStep || rawUser.nextStep || existingUser.nextStep || 'dashboard',
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

  /**
   * PUT /api/v1/auth/profile
   * @param {Object} profileData - { fullName, phoneNumber, farmName, farmAddress, email }
   */
  async updateProfile(profileData = {}) {
    const payload = {};
    if (profileData.fullName) payload.fullName = profileData.fullName.trim();
    if (profileData.email) payload.email = profileData.email.trim();
    if (profileData.phoneNumber) payload.phoneNumber = profileData.phoneNumber.trim();

    let serverData = null;
    try {
      const response = await apiClient.put('/auth/profile', payload);
      serverData = response?.data || response;
    } catch (err) {
      console.warn('[AuthService] Server profile update fallback:', err);
    }

    const existingUser = this.getUser() || {};
    const updatedUser = {
      ...existingUser,
      ...profileData,
      ...(serverData && typeof serverData === 'object' ? serverData : {}),
    };

    this.setUser(updatedUser);
    return updatedUser;
  }

  /**
   * POST /api/v1/auth/change-password
   * @param {Object} passwordData - { oldPassword, newPassword }
   */
  async changePassword({ oldPassword, newPassword }) {
    if (!oldPassword || !newPassword) {
      throw new APIError('Password saat ini dan baru wajib diisi.', 400);
    }
    return apiClient.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  }
}

export default new AuthService();
export { AuthService };

