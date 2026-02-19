/** 帮助与反馈页 */
import { submitFeedback as submitFeedbackApi } from '../../apis/feedback'

Page({
    data: {
        feedbackContent: '',
        feedbackLength: 0,
        isSubmitting: false,
    },

    /** 输入反馈内容 */
    handleFeedbackInput(e: WechatMiniprogram.TextareaInput) {
        const value = (e.detail.value || '').trimStart()
        this.setData({
            feedbackContent: value,
            feedbackLength: value.length,
        })
    },

    /** 提交反馈 */
    async submitFeedback() {
        if (this.data.isSubmitting) return
        const content = this.data.feedbackContent.trim()
        if (!content) {
            wx.showToast({ title: '请填写反馈内容', icon: 'none' })
            return
        }

        this.setData({ isSubmitting: true })
        try {
            await submitFeedbackApi({ content })
            this.setData({ feedbackContent: '', feedbackLength: 0 })
            wx.showToast({ title: '反馈已提交', icon: 'success' })
        } catch (err) {
            wx.showToast({ title: (err as Error).message || '提交失败', icon: 'none' })
        } finally {
            this.setData({ isSubmitting: false })
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
