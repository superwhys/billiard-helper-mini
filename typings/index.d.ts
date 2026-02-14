/// <reference path="./types/index.d.ts" />

interface IAppOption {
    globalData: {
        statusBarHeight: number,
        navBarHeight: number,
    }
    checkLogin(): Promise<void>
}
