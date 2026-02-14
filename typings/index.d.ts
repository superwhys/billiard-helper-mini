/// <reference path="./types/index.d.ts" />

interface IAppOption {
    globalData: {
        statusBarHeight: number,
        navBarHeight: number,
    }
    tryLoadUser(): Promise<void>
}
