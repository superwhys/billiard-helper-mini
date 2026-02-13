// app.ts
const BG_COLOR = '#081410'

App<IAppOption>({
    globalData: {
        statusBarHeight: 0,
        navBarHeight: 0,
    },

    onLaunch() {
        const sysInfo = wx.getSystemInfoSync()
        const statusBarHeight = sysInfo.statusBarHeight ?? 0
        this.globalData.statusBarHeight = statusBarHeight
        this.globalData.navBarHeight = statusBarHeight + 44

        // 在原生层设置窗口底色，消除 CSS 加载前的白屏
        wx.setBackgroundColor({
            backgroundColor: BG_COLOR,
            backgroundColorTop: BG_COLOR,
            backgroundColorBottom: BG_COLOR,
        })
    },
})
