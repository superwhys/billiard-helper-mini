/** 我的页面 */
import { getCurrentUser, updateUser, logout } from '../../services/account'
import { wxLogin } from '../../apis/account'
import { clearTokens, getToken, setToken, setRefreshToken } from '../../apis/api'
import { userStore } from '../../stores/user'

Page({
    data: {
        isLoggedIn: false,
        isLoggingIn: false,
        displayName: '游客',
        avatarLetter: '?',
        settings: [
            { title: '帮助与反馈', desc: '常见问题与建议入口', icon: 'help', arrow: true },
            { title: '关于应用', desc: '版本与开发信息', icon: 'about', arrow: true },
        ],
        showEditModal: false,
        draftName: '',
        isSaving: false,
        isLoggingOut: false,
    },

    onShow() {
        this.refreshProfile()
    },

    /** 刷新用户信息，未登录时显示游客状态 */
    async refreshProfile() {
        const token = getToken()
        if (!token) {
            this.setData({
                isLoggedIn: false,
                displayName: '游客',
                avatarLetter: '?',
            })
            return
        }

        try {
            const profile = await getCurrentUser()
            userStore.setProfile(profile)
            const name = profile.name || '游客'
            this.setData({
                isLoggedIn: true,
                displayName: name,
                avatarLetter: name.trim() ? name.slice(0, 1).toUpperCase() : '?',
            })
        } catch (err) {
            console.error('获取用户信息失败', err)
            // token 可能已过期被清除，重新检查
            if (!getToken()) {
                this.setData({
                    isLoggedIn: false,
                    displayName: '游客',
                    avatarLetter: '?',
                })
                return
            }
            const cached = userStore.getProfile()
            if (cached) {
                const name = cached.name || '游客'
                this.setData({
                    isLoggedIn: true,
                    displayName: name,
                    avatarLetter: name.trim() ? name.slice(0, 1).toUpperCase() : '?',
                })
            }
        }
    },

    /** 微信一键登录 */
    async handleLogin() {
        if (this.data.isLoggingIn) return
        this.setData({ isLoggingIn: true })

        try {
            const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
                (resolve, reject) => {
                    wx.login({ success: resolve, fail: reject })
                },
            )

            const tokenRes = await wxLogin({ code: loginRes.code })
            setToken(tokenRes.access_token)
            setRefreshToken(tokenRes.refresh_token)

            await this.refreshProfile()
            wx.showToast({ title: '登录成功', icon: 'success' })
        } catch (err) {
            console.error('微信登录失败', err)
            wx.showToast({ title: (err as Error).message || '登录失败，请重试', icon: 'none' })
        } finally {
            this.setData({ isLoggingIn: false })
        }
    },

    /** 打开修改昵称弹窗 */
    openEdit() {
        this.setData({
            showEditModal: true,
            draftName: this.data.displayName,
        })
    },

    /** 关闭修改昵称弹窗 */
    closeEdit() {
        if (this.data.isSaving) return
        this.setData({ showEditModal: false })
    },

    /** 通过 form submit 保存昵称（配合 type=nickname 安全检测） */
    async saveName(e: WechatMiniprogram.FormSubmit) {
        const nextName = ((e.detail.value as Record<string, string>).nickname || '').trim()
        if (!nextName || this.data.isSaving) return

        this.setData({ isSaving: true })
        try {
            await updateUser({ name: nextName })
            const profile = userStore.getProfile()
            if (profile) {
                userStore.setProfile({ ...profile, name: nextName })
            }
            this.setData({
                displayName: nextName,
                avatarLetter: nextName.slice(0, 1).toUpperCase(),
                showEditModal: false,
            })
            wx.showToast({ title: '保存成功', icon: 'success' })
        } catch (err) {
            console.error('保存失败', err)
            wx.showToast({ title: (err as Error).message || '保存失败', icon: 'none' })
        } finally {
            this.setData({ isSaving: false })
        }
    },

    /** 退出登录 */
    async handleLogout() {
        if (this.data.isLoggingOut) return

        this.setData({ isLoggingOut: true })
        try {
            await logout()
        } catch (err) {
            console.error('退出失败', err)
        } finally {
            userStore.setProfile(null)
            clearTokens()
            this.setData({
                isLoggingOut: false,
                isLoggedIn: false,
                displayName: '游客',
                avatarLetter: '?',
            })
            wx.showToast({ title: '已退出登录', icon: 'success' })
        }
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        return {
            title: '台球计分助手 - 一起来打球吧',
            path: '/pages/home/home',
        }
    },
})
