/** 关于应用页 */
Page({
    data: {
        appName: '台球计分助手',
        version: '1.0.3',
        envLabel: '开发版',
    },

    onLoad() {
        try {
            const info = wx.getAccountInfoSync()
            const envVersion = info?.miniProgram?.envVersion || 'develop'
            const version = info?.miniProgram?.version || '1.0.0'
            const envLabelMap: Record<string, string> = {
                develop: '开发版',
                trial: '体验版',
                release: '正式版',
            }
            this.setData({
                version,
                envLabel: envLabelMap[envVersion] || '开发版',
            })
        } catch {
            this.setData({ version: '1.0.0', envLabel: '开发版' })
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
