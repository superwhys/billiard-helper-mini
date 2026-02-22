/** 公共请求工具，基于 wx.request 封装，统一处理鉴权、错误与 Token 刷新 */
import { getApiBaseUrl } from '../utils/api-base'
import type { TokenResponse } from '../utils/api-types'
import { waitLoginReady } from '../utils/login-ready'
import { requestWxLoginToken } from '../utils/wx-login'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ApiResponse<T> {
    code: number
    data: T
    message: string
}

const API_BASE_URL = getApiBaseUrl()
const TOKEN_EXPIRED_CODE = 400002
const INVALID_TOKEN_CODE = 400003
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

const SYSTEM_ERROR_MESSAGE = '系统异常，请刷新小程序后重试'

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

async function waitForLoginReady() {
    try {
        await waitLoginReady()
    } catch {
        // 忽略登录等待异常，继续走后续请求
    }
}

function shouldWaitLoginReady(url: string) {
    if (url === '/account/wx-login') return false
    return true
}

// ===== Token 刷新 =====

let refreshPromise: Promise<boolean> | null = null

function reloginByWx(): Promise<TokenResponse | null> {
    return requestWxLoginToken()
}

function showSystemErrorModal() {
    wx.showToast({ title: SYSTEM_ERROR_MESSAGE, icon: 'none' })
}

function refreshAccessToken(): Promise<boolean> {
    if (refreshPromise) return refreshPromise

    const refreshToken = getRefreshToken()
    if (!refreshToken) {
        showSystemErrorModal()
        return Promise.resolve(false)
    }

    refreshPromise = new Promise<boolean>((resolve) => {
        wx.request({
            url: `${API_BASE_URL}/account/refresh`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { refresh_token: refreshToken },
            success(res) {
                if (res.statusCode !== 200) {
                    showSystemErrorModal()
                    resolve(false)
                    return
                }

                const payload = res.data as ApiResponse<TokenResponse>
                if (payload.code === 0) {
                    setToken(payload.data.access_token)
                    setRefreshToken(payload.data.refresh_token)
                    resolve(true)
                    return
                }

                // 无效的 token
                if (payload.code === INVALID_TOKEN_CODE) {
                    console.error("refresh token 无效")
                    showSystemErrorModal()
                    resolve(false)
                    return
                }

                // refresh token 过期, 自动重新登录
                if (payload.code === TOKEN_EXPIRED_CODE) {
                    console.error("refresh token 过期, 自动重新登录")
                    reloginByWx().then((tokenRes) => {
                        if (!tokenRes) {
                            showSystemErrorModal()
                            resolve(false)
                            return
                        }
                        setToken(tokenRes.access_token)
                        setRefreshToken(tokenRes.refresh_token)
                        resolve(true)
                    })
                    return
                }

                // 其他错误
                console.error("刷新 token 失败: " + payload.code + " " + payload.message)
                showSystemErrorModal()
                resolve(false)
                return
            },
            fail() {
                showSystemErrorModal()
                resolve(false)
            },
            complete() {
                refreshPromise = null
            },
        })
    })

    return refreshPromise
}

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

    return (async () => {
        if (shouldWaitLoginReady(url)) {
            await waitForLoginReady()
        }
        return new Promise<T>((resolve, reject) => {
            wx.request({
                url: fetchUrl,
                method,
                header: getHeaders(),
                data: method === 'GET' ? undefined : data as WechatMiniprogram.IAnyObject,
                success(res) {
                    const payload = res.data as ApiResponse<T>
                    if (payload?.code === INVALID_TOKEN_CODE) {
                        wx.showToast({ title: '系统异常，请刷新小程序后重试', icon: 'none' })
                        reject(new Error('系统异常，请刷新小程序后重试'))
                        return
                    }

                    if (res.statusCode === 200) {
                        if (payload.code !== 0) {
                            reject(new Error(payload.message || '请求失败'))
                            return
                        }

                        // 请求成功
                        resolve(payload.data)
                        return
                    }

                    // 处理鉴权错误
                    if (res.statusCode === 401) {
                        // token 过期，刷新 token
                        if (payload?.code === TOKEN_EXPIRED_CODE && canRetryAuth) {
                            console.error("token 过期，刷新 token")
                            ;(async () => {
                                const refreshed = await refreshAccessToken()
                                if (refreshed) {
                                    try {
                                        const result = await request<T>(url, method, data, params, false)
                                        resolve(result)
                                    } catch (err) {
                                        reject(err)
                                    }
                                    return
                                }

                                // 刷新 token 失败，清除 token
                                handleUnauthorized()
                                reject(new Error('系统异常，请刷新小程序后重试'))
                            })()
                            return
                        }

                        handleUnauthorized()
                        console.error("鉴权错误: " + res.statusCode + " " + payload?.message)
                        reject(new Error('系统异常，请刷新小程序后重试'))
                        return
                    }

                    // 处理其他错误
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        console.error("网络请求失败: " + res.statusCode)
                        reject(new Error('网络请求失败，请稍后再试'))
                        return
                    }

                    console.error("未知错误: " + res.statusCode)
                    reject(new Error("未知错误: " + res.statusCode))
                },
                fail(err) {
                    wx.showToast({ title: '网络连接失败，请检查网络', icon: 'none' })
                    reject(new Error(err.errMsg || '网络连接失败，请检查网络'))
                },
            })
        })
    })()
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
