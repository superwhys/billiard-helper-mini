// app.ts
import { getCurrentUser } from './services/account'
import { getToken } from './apis/api'
import { userStore } from './stores/user'

const BG_COLOR = '#081410'

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

        this.checkLogin()
    },

    /** 检查登录状态，未登录则跳转登录页 */
    async checkLogin() {
        const token = getToken()
        if (!token) {
            wx.reLaunch({ url: '/pages/login/login' })
            return
        }

        try {
            const user = await getCurrentUser()
            userStore.setProfile(user)
        } catch (_err) {
            // 401 等错误会由 api.ts handleUnauthorized 自动跳转登录页
        }
    },
})
