/**
 * 对局服务适配层
 * 当前使用 mock 数据，后续替换为真实 API 调用时只需修改此文件
 */
import type {
    Match, MatchListRequest, DeleteMatchRequest,
    CreateMatchRequest, StartMatchRequest, JoinMatchRequest,
    LeaveMatchRequest, UpdateMatchRequest,
} from '../types/game'

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

var nextMockId = 100

function getMockCreateMatch(params: CreateMatchRequest): Promise<Match> {
    var id = nextMockId++
    var match: Match = {
        id: id,
        name: params.name,
        match_type: params.match_type,
        match_round: 0,
        config: { max_players: params.max_players, target_score: params.target_score },
        created_at: new Date().toISOString(),
        owner_id: 1,
        players: (params.virtual_players || []).map(function (p, i) {
            return { id: i + 1, nick_name: p.nick_name || ('玩家 ' + (i + 1)), type: p.type, code: 'p' + id + '_' + (i + 1) }
        }),
        status: 1,
    }
    mockMatches.unshift(match)
    return Promise.resolve(JSON.parse(JSON.stringify(match)))
}

function getMockStartMatch(params: StartMatchRequest): Promise<Match> {
    var match = mockMatches.find(function (m) { return m.id === params.match_id })
    if (!match) return Promise.reject(new Error('对局不存在'))
    match.status = 2
    return Promise.resolve(JSON.parse(JSON.stringify(match)))
}

function getMockJoinMatch(params: JoinMatchRequest): Promise<Match> {
    var match = mockMatches.find(function (m) { return m.id === params.match_id })
    if (!match) return Promise.reject(new Error('对局不存在'))
    var pid = (match.players.length > 0 ? Math.max.apply(null, match.players.map(function (p) { return p.id || 0 })) : 0) + 1
    match.players.push({
        id: pid,
        nick_name: params.nick_name,
        type: params.player_type,
        code: 'p' + match.id + '_' + pid,
    })
    return Promise.resolve(JSON.parse(JSON.stringify(match)))
}

function getMockLeaveMatch(params: LeaveMatchRequest): Promise<Match> {
    var match = mockMatches.find(function (m) { return m.id === params.match_id })
    if (!match) return Promise.reject(new Error('对局不存在'))
    match.players = match.players.filter(function (p) { return p.code !== params.player_code })
    return Promise.resolve(JSON.parse(JSON.stringify(match)))
}

function getMockUpdateMatch(params: UpdateMatchRequest): Promise<Match> {
    var match = mockMatches.find(function (m) { return m.id === params.match_id })
    if (!match) return Promise.reject(new Error('对局不存在'))
    match.name = params.name
    match.config.target_score = params.target_score
    if (params.config_data) { match.config.data = params.config_data }
    return Promise.resolve(JSON.parse(JSON.stringify(match)))
}

// ===== 导出当前使用的适配实现 =====
// TODO: 接入后端后，将下方替换为真实 API 实现

export const getMatchList = getMockMatchList
export const deleteMatch = getMockDeleteMatch
export const createMatch = getMockCreateMatch
export const startMatch = getMockStartMatch
export const joinMatch = getMockJoinMatch
export const leaveMatch = getMockLeaveMatch
export const updateMatch = getMockUpdateMatch
