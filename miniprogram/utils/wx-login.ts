import { getApiBaseUrl } from './api-base'
import type { TokenResponse } from './api-types'

export function requestWxLoginToken(): Promise<TokenResponse | null> {
    const baseUrl = getApiBaseUrl()
    return new Promise<TokenResponse | null>((resolve) => {
        wx.login({
            success: (res) => {
                wx.request({
                    url: `${baseUrl}/account/wx-login`,
                    method: 'POST',
                    header: { 'Content-Type': 'application/json' },
                    data: { code: res.code },
                    success(resp) {
                        if (resp.statusCode !== 200) {
                            resolve(null)
                            return
                        }
                        const payload = resp.data as { code: number; data: TokenResponse }
                        if (payload.code !== 0) {
                            resolve(null)
                            return
                        }
                        resolve(payload.data)
                    },
                    fail() {
                        resolve(null)
                    },
                })
            },
            fail: () => {
                resolve(null)
            },
        })
    })
}
