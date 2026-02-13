/** 基础 HTTP 请求封装，后续接入真实 API 时在此配置 baseUrl 和 token */

const BASE_URL = ''

export interface RequestOptions {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: Record<string, unknown>
    header?: Record<string, string>
}

/** 发起请求（预留，当前版本使用 mock 数据） */
export function request<T>(options: RequestOptions): Promise<T> {
    return new Promise((resolve, reject) => {
        wx.request({
            url: `${BASE_URL}${options.url}`,
            method: options.method || 'GET',
            data: options.data,
            header: {
                'Content-Type': 'application/json',
                ...options.header,
            },
            success(res) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data as T)
                } else {
                    reject(new Error(`请求失败: ${res.statusCode}`))
                }
            },
            fail(err) {
                reject(err)
            },
        })
    })
}

export function get<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    return request<T>({ url, method: 'GET', data })
}

export function post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
    return request<T>({ url, method: 'POST', data })
}
