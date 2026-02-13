/**
 * 账户服务适配层
 * 当前使用 mock 数据，后续替换为真实 API 调用时只需修改此文件
 */
import type { User, UpdateUserReq } from '../types/user'

// ===== Mock 数据 =====

const mockUser: User = {
    id: 1,
    name: 'hoven',
    avatar: '',
    email: 'hoven@example.com',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
}

// ===== Mock 实现 =====

function getMockCurrentUser(): Promise<User> {
    return Promise.resolve({ ...mockUser })
}

function mockUpdateUser(data: UpdateUserReq): Promise<void> {
    mockUser.name = data.name
    mockUser.updated_at = new Date().toISOString()
    return Promise.resolve()
}

function mockLogout(): Promise<void> {
    return Promise.resolve()
}

// ===== 导出当前使用的适配实现 =====
// TODO: 接入后端后，将下方替换为真实 API 实现

export const getCurrentUser = getMockCurrentUser
export const updateUser = mockUpdateUser
export const logout = mockLogout
