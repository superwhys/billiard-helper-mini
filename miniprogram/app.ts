// app.ts
App<IAppOption>({
    globalData: {
        statusBarHeight: 0,
    },

    onLaunch() {
        const sysInfo = wx.getSystemInfoSync()
        this.globalData.statusBarHeight = sysInfo.statusBarHeight ?? 0
    },
})
