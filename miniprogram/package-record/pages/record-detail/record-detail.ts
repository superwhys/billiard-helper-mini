/** 对局详情页（占位） */
Page({
    data: {
        matchId: 0,
    },

    onLoad(options: Record<string, string>) {
        var matchId = Number(options.matchId || 0)
        this.setData({ matchId: matchId })
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        return {
            title: '台球计分助手 - 一起来打球吧',
            path: '/pages/home/home',
        }
    },
})
