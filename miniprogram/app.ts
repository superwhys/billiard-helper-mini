// app.ts
import { getCurrentUser } from './services/account'
import { getToken } from './apis/api'
import { userStore } from './stores/user'


App<IAppOption>({
    globalData: {
        statusBarHeight: 0,
        navBarHeight: 0,
    },

    onLaunch() {
        const sysInfo = wx.getSystemInfoSync()
        const statusBarHeight = sysInfo.statusBarHeight ?? 0
        this.globalData.statusBarHeight = statusBarHeight
        this.globalData.navBarHeight = statusBarHeight + 44

        this.tryLoadUser()
    },

    /** 尝试加载用户信息，未登录则静默跳过 */
    async tryLoadUser() {
        const token = getToken()
        if (!token) return

        try {
            const user = await getCurrentUser()
            userStore.setProfile(user)
        } catch (_err) {
            // token 过期等错误由 api.ts handleUnauthorized 清除 token
        }
    },
})
