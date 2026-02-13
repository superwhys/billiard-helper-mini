/**
 * 对局服务适配层
 * 当前使用 mock 数据，后续替换为真实 API 调用时只需修改此文件
 */
import type { Match, MatchListRequest, DeleteMatchRequest, MatchType } from '../types/game'

// ===== Mock 数据 =====

const mockMatches: Match[] = [
    {
        id: 1,
        name: 'hoven的对局',
        match_type: '9ball',
        match_round: 1,
        config: { max_players: 4, target_score: 5 },
        created_at: '2025-12-20T14:30:00Z',
        owner_id: 1,
        players: [
            { id: 1, nick_name: 'hoven', type: 1, code: 'p1' },
            { id: 2, nick_name: '小明', type: 1, code: 'p2' },
        ],
        status: 3,
    },
    {
        id: 2,
        name: '周末友谊赛',
        match_type: 'snooker',
        match_round: 1,
        config: { max_players: 2, target_score: 3 },
        created_at: '2025-12-18T10:00:00Z',
        owner_id: 1,
        players: [
            { id: 3, nick_name: 'hoven', type: 1, code: 'p3' },
            { id: 4, nick_name: '小红', type: 1, code: 'p4' },
        ],
        status: 3,
    },
    {
        id: 3,
        name: '练习赛',
        match_type: '8ball',
        match_round: 1,
        config: { max_players: 2, target_score: 7 },
        created_at: '2025-12-15T19:00:00Z',
        owner_id: 1,
        players: [
            { id: 5, nick_name: 'hoven', type: 1, code: 'p5' },
            { id: 6, nick_name: '小李', type: 1, code: 'p6' },
        ],
        status: 2,
    },
    {
        id: 4,
        name: '九球挑战',
        match_type: '9ball',
        match_round: 2,
        config: { max_players: 2, target_score: 5 },
        created_at: '2025-12-10T16:00:00Z',
        owner_id: 1,
        players: [
            { id: 7, nick_name: 'hoven', type: 1, code: 'p7' },
            { id: 8, nick_name: '小王', type: 1, code: 'p8' },
        ],
        status: 3,
    },
]

// ===== Mock 实现 =====

function getMockMatchList(params?: MatchListRequest): Promise<Match[]> {
    let list = [...mockMatches]

    if (params?.match_type) {
        list = list.filter((m) => m.match_type === params.match_type)
    }

    if (params?.cursor) {
        const idx = list.findIndex((m) => m.id === params.cursor)
        if (idx >= 0) {
            list = list.slice(idx + 1)
        }
    }

    const limit = params?.limit ?? 10
    return Promise.resolve(list.slice(0, limit))
}

function getMockDeleteMatch(params: DeleteMatchRequest): Promise<void> {
    const idx = mockMatches.findIndex((m) => m.id === params.match_id)
    if (idx >= 0) {
        mockMatches.splice(idx, 1)
    }
    return Promise.resolve()
}

// ===== 导出当前使用的适配实现 =====
// TODO: 接入后端后，将下方替换为真实 API 实现

export const getMatchList = getMockMatchList
export const deleteMatch = getMockDeleteMatch
