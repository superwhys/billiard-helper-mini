/** 我的页面 */
import { getCurrentUser, updateUser, logout } from '../../services/account'
import { clearTokens } from '../../apis/api'
import { userStore } from '../../stores/user'

Page({
    data: {
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

    /** 刷新用户信息 */
    async refreshProfile() {
        try {
            const profile = await getCurrentUser()
            userStore.setProfile(profile)
            const name = profile.name || '游客'
            this.setData({
                displayName: name,
                avatarLetter: name.trim() ? name.slice(0, 1).toUpperCase() : '?',
            })
        } catch (err) {
            console.error('获取用户信息失败', err)
            const cached = userStore.getProfile()
            if (cached) {
                const name = cached.name || '游客'
                this.setData({
                    displayName: name,
                    avatarLetter: name.trim() ? name.slice(0, 1).toUpperCase() : '?',
                })
            }
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
            this.setData({ isLoggingOut: false })
            wx.reLaunch({ url: '/pages/login/login' })
        }
    },
})
