/** 对局状态管理，封装本地存储 */
import type { Match } from '../types/game'

const STORAGE_KEY = 'billiard_current_match'

export const gameStore = {
    getCurrentMatch(): Match | null {
        try {
            return wx.getStorageSync(STORAGE_KEY) || null
        } catch {
            return null
        }
    },

    setCurrentMatch(match: Match | null) {
        if (match) {
            wx.setStorageSync(STORAGE_KEY, match)
        } else {
            wx.removeStorageSync(STORAGE_KEY)
        }
    },

    clearCurrentMatch() {
        wx.removeStorageSync(STORAGE_KEY)
    },
}
