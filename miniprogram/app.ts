// app.ts
import { getCurrentUser } from './apis/account'
import { getToken, setRefreshToken, setToken } from './apis/api'
import { userStore } from './stores/user'
import { markLoginReady, waitLoginReady } from './utils/login-ready'
import { requestWxLoginToken } from './utils/wx-login'

let shouldShowInitialUserLoading = true

/** 启动时自动微信登录，获取基础 token */
function ensureWxLogin(onDone: () => void) {
    const token = getToken()
    if (token) {
        onDone()
        markLoginReady()
        return
    }

    wx.showLoading({ title: '加载中', mask: true })
    requestWxLoginToken()
        .then((tokenRes) => {
            if (!tokenRes) {
                wx.showToast({ title: '系统异常, 请刷新小程序后重试', icon: 'none' })
                return
            }
            setToken(tokenRes.access_token)
            setRefreshToken(tokenRes.refresh_token)
        })
        .catch(() => {
            wx.showToast({ title: '系统异常, 请刷新小程序后重试', icon: 'none' })
        })
        .finally(() => {
            wx.hideLoading()
            onDone()
            markLoginReady()
        })
}

App<IAppOption>({
    globalData: {
        statusBarHeight: 0,
        navBarHeight: 0,
        loginReady: waitLoginReady(),
    },

    onLaunch() {
        const sysInfo = wx.getSystemInfoSync()
        const statusBarHeight = sysInfo.statusBarHeight ?? 0
        this.globalData.statusBarHeight = statusBarHeight
        this.globalData.navBarHeight = statusBarHeight + 44

        ensureWxLogin(() => {
            this.tryLoadUser()
        })
    },

    /** 尝试加载用户信息，未登录则静默跳过 */
    async tryLoadUser() {
        const token = getToken()
        if (!token) return

        const withLoading = shouldShowInitialUserLoading
        if (withLoading) {
            wx.showLoading({ title: '加载中', mask: true })
        }

        try {
            const user = await getCurrentUser()
            userStore.setProfile(user)
        } catch (_err) {
            // token 过期等错误由 api.ts handleUnauthorized 清除 token
        } finally {
            if (withLoading) {
                wx.hideLoading()
                shouldShowInitialUserLoading = false
            }
        }
    },

})
