/** 用户状态管理，封装本地存储 */
import type { User } from '../types/user'

const STORAGE_KEY = 'billiard_user_profile'

export const userStore = {
    getProfile(): User | null {
        try {
            return wx.getStorageSync(STORAGE_KEY) || null
        } catch {
            return null
        }
    },

    setProfile(user: User | null) {
        if (user) {
            wx.setStorageSync(STORAGE_KEY, user)
        } else {
            wx.removeStorageSync(STORAGE_KEY)
        }
    },

    getName(): string {
        return this.getProfile()?.name || '游客'
    },

    getAvatarLetter(): string {
        const name = this.getName().trim()
        return name ? name.slice(0, 1).toUpperCase() : '?'
    },
}
