/** 公共请求工具，基于 wx.request 封装，统一处理鉴权、错误与 Token 刷新 */

export interface TokenResponse {
    access_token: string
    refresh_token: string
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ApiResponse<T> {
    code: number
    data: T
    message: string
}

/** 根据小程序运行环境返回对应的 API 地址 */
function getApiBaseUrl(): string {
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

const API_BASE_URL = getApiBaseUrl()
const TOKEN_EXPIRED_CODE = 400002
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

// ===== Token 管理 =====

export function getToken(): string {
    try {
        return wx.getStorageSync(TOKEN_KEY) || ''
    } catch {
        return ''
    }
}

export function setToken(token: string) {
    wx.setStorageSync(TOKEN_KEY, token)
}

export function getRefreshToken(): string {
    try {
        return wx.getStorageSync(REFRESH_TOKEN_KEY) || ''
    } catch {
        return ''
    }
}

export function setRefreshToken(token: string) {
    wx.setStorageSync(REFRESH_TOKEN_KEY, token)
}

export function clearTokens() {
    wx.removeStorageSync(TOKEN_KEY)
    wx.removeStorageSync(REFRESH_TOKEN_KEY)
}

// ===== 工具函数 =====

function buildUrl(url: string, params?: Record<string, unknown>): string {
    const fullUrl = `${API_BASE_URL}${url}`
    if (!params) return fullUrl

    const parts: string[] = []
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    })
    const query = parts.join('&')
    return query ? `${fullUrl}?${query}` : fullUrl
}

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    const token = getToken()
    if (token) {
        headers.Authorization = `Bearer ${token}`
        headers.access_token = token
    }
    return headers
}

// ===== Token 刷新 =====

let refreshPromise: Promise<TokenResponse | null> | null = null

function refreshAccessToken(): Promise<TokenResponse | null> {
    if (refreshPromise) return refreshPromise

    const refreshToken = getRefreshToken()
    if (!refreshToken) return Promise.resolve(null)

    refreshPromise = new Promise<TokenResponse | null>((resolve) => {
        wx.request({
            url: `${API_BASE_URL}/account/refresh`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { refresh_token: refreshToken },
            success(res) {
                if (res.statusCode !== 200) {
                    resolve(null)
                    return
                }
                const payload = res.data as ApiResponse<TokenResponse>
                if (payload.code !== 0) {
                    resolve(null)
                    return
                }
                resolve(payload.data)
            },
            fail() {
                resolve(null)
            },
            complete() {
                refreshPromise = null
            },
        })
    })

    return refreshPromise
}

/** 清除鉴权状态，不主动跳转登录页 */
function handleUnauthorized() {
    clearTokens()
}

// ===== 核心请求方法 =====

function request<T>(
    url: string,
    method: HttpMethod,
    data?: unknown,
    params?: Record<string, unknown>,
    canRetryAuth = true,
): Promise<T> {
    const fetchUrl = method === 'GET' ? buildUrl(url, params) : `${API_BASE_URL}${url}`

    return new Promise<T>((resolve, reject) => {
        wx.request({
            url: fetchUrl,
            method,
            header: getHeaders(),
            data: method === 'GET' ? undefined : data as WechatMiniprogram.IAnyObject,
            success(res) {
                const payload = res.data as ApiResponse<T>

                if (res.statusCode === 401) {
                    if (payload?.code === TOKEN_EXPIRED_CODE && canRetryAuth) {
                        refreshAccessToken()
                            .then((refreshed) => {
                                if (refreshed) {
                                    setToken(refreshed.access_token)
                                    setRefreshToken(refreshed.refresh_token)
                                    return request<T>(url, method, data, params, false)
                                }
                                handleUnauthorized()
                                return Promise.reject(new Error('需要登录后才能操作'))
                            })
                            .then(resolve)
                            .catch(reject)
                        return
                    }

                    handleUnauthorized()
                    const msg = payload?.message === 'No Token'
                        ? '需要登录后才能操作'
                        : (payload?.message || '需要登录后才能操作')
                    reject(new Error(msg))
                    return
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(payload?.message || '网络请求失败，请稍后再试'))
                    return
                }

                if (payload.code !== 0) {
                    reject(new Error(payload.message || '请求失败'))
                    return
                }

                resolve(payload.data)
            },
            fail(err) {
                reject(new Error(err.errMsg || '网络连接失败，请检查网络'))
            },
        })
    })
}

// ===== 导出快捷方法 =====

export function get<T>(url: string, params?: Record<string, unknown>) {
    return request<T>(url, 'GET', undefined, params)
}

export function post<T>(url: string, data?: unknown) {
    return request<T>(url, 'POST', data)
}

export function put<T>(url: string, data?: unknown) {
    return request<T>(url, 'PUT', data)
}

function deleteRequest<T>(url: string, data?: unknown) {
    return request<T>(url, 'DELETE', data)
}

export { deleteRequest }

export const api = {
    get,
    post,
    put,
    delete: deleteRequest,
}
