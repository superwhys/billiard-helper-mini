/** 我的页面 */
import { getCurrentUser, updateUser, logout } from '../../services/account'
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

    /** 输入昵称 */
    onNameInput(e: WechatMiniprogram.Input) {
        this.setData({ draftName: e.detail.value })
    },

    /** 保存昵称 */
    async saveName() {
        const nextName = this.data.draftName.trim()
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
            wx.showToast({ title: '保存失败', icon: 'none' })
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
            wx.removeStorageSync('access_token')
            wx.removeStorageSync('refresh_token')
            this.setData({
                displayName: '游客',
                avatarLetter: '?',
                isLoggingOut: false,
            })
            wx.showToast({ title: '已退出登录', icon: 'none' })
        }
    },
})
