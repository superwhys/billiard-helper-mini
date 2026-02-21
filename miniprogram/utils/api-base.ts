/** 根据小程序运行环境返回对应的 API 地址 */
export function getApiBaseUrl(): string {
    const envMap: Record<string, string> = {
        release: 'https://billiard.superwhys.top/api',   // 正式版
        trial: 'https://billiard.superwhys.top/api',      // 体验版
        develop: 'http://127.0.0.1:8080/api',      // 开发版
    }
    try {
        const { miniProgram } = wx.getAccountInfoSync()
        return envMap[miniProgram.envVersion] || envMap.develop
    } catch {
        return envMap.develop
    }
}
