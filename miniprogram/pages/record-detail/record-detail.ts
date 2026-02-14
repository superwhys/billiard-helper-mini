/** 对局详情页（占位） */
Page({
    data: {
        matchId: 0,
    },

    onLoad(options: Record<string, string>) {
        var matchId = Number(options.matchId || 0)
        this.setData({ matchId: matchId })
    },
})
