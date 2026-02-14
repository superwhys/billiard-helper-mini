/** 微信登录页 */
import { wxLogin } from '../../apis/account'
import { setToken, setRefreshToken } from '../../apis/api'

Page({
    data: {
        isLoading: false,
    },

    /** 微信一键登录 */
    async handleWxLogin() {
        if (this.data.isLoading) return
        this.setData({ isLoading: true })

        try {
            const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
                (resolve, reject) => {
                    wx.login({
                        success: resolve,
                        fail: reject,
                    })
                },
            )

            const tokenRes = await wxLogin({ code: loginRes.code })
            setToken(tokenRes.access_token)
            setRefreshToken(tokenRes.refresh_token)

            wx.reLaunch({ url: '/pages/home/home' })
        } catch (err) {
            console.error('微信登录失败', err)
            wx.showToast({ title: (err as Error).message || '登录失败，请重试', icon: 'none' })
        } finally {
            this.setData({ isLoading: false })
        }
    },
})
