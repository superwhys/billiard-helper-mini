/** 游戏模式 ID */
export type GameModeId = 'nine-ball' | 'eight-ball' | 'snooker' | 'more'

/** 对局类型（后端字段） */
export type MatchType = 'snooker' | '8ball' | '9ball'

/** 玩家类型: 1=虚拟玩家, 2=在线玩家 */
export type PlayerType = 1 | 2

/** 游戏模式 */
export interface GameMode {
    id: GameModeId
    title: string
    desc: string
    badge: string
    maxPlayers: number
    isEnabled: boolean
}

/** 玩家 */
export interface Player {
    code?: string
    id?: number
    join_time?: string
    nick_name?: string
    type?: PlayerType
    user_id?: number
}

/** 对局配置 */
export interface MatchConfig {
    max_players: number
    target_score: number
    data?: Record<string, unknown>
}

// {45: {extra: {}, score: 5}, 46: {extra: {}, score: 2}}
export interface MatchGameScore {
    [player_id: number]: {
        extra: Record<string, unknown>
        score: number
    }
}

export interface MatchGame {
    id: number
    match_id: number
    game_num: number
    start_at: number
    end_at: number
    winner_id?: number
    last_event_id?: number
    scores?: MatchGameScore
}

/** 对局 */
export interface Match {
    match_type: MatchType
    match_round: number
    config: MatchConfig
    created_at: string
    id: number
    name: string
    owner_id: number
    players: Player[]
    status: number
    current_scores?: MatchGameScore
    match_game?: MatchGame[]
    winner_id?: number
    winner_score?: number
}

/** 对局列表请求参数 */
export interface MatchListRequest {
    cursor?: number
    limit?: number
    match_type?: MatchType
}

/** 删除对局请求 */
export interface DeleteMatchRequest {
    match_id: number
}

/** 创建对局请求 */
export interface CreateMatchRequest {
    match_type: MatchType
    max_players: number
    name: string
    target_score: number
    virtual_players: Player[]
}

/** 开始对局请求 */
export interface StartMatchRequest {
    match_id: number
}

/** 加入对局请求 */
export interface JoinMatchRequest {
    match_id: number
    nick_name: string
    player_type: PlayerType
}

/** 离开对局请求 */
export interface LeaveMatchRequest {
    match_id: number
    player_code: string
}

/** 更新对局请求 */
export interface UpdateMatchRequest {
    match_id: number
    name: string
    target_score: number
    config_data?: Record<string, unknown>
}

/** 对局操作请求（下一局/结束对局等） */
export interface MatchActionRequest {
    match_id: number
    player_code?: string
}

/** 对局详情请求 */
export interface MatchDetailRequest {
    match_id: number
}

// ===== 游戏模式常量 =====

export const NineBallGame: GameMode = {
    id: 'nine-ball', title: '九球', desc: '追分赛', badge: '9', maxPlayers: 4, isEnabled: true,
}

export const EightBallGame: GameMode = {
    id: 'eight-ball', title: '中八', desc: '标准计分', badge: '8', maxPlayers: 2, isEnabled: true,
}

export const SnookerGame: GameMode = {
    id: 'snooker', title: '斯诺克', desc: '147满分制', badge: '●', maxPlayers: 2, isEnabled: false,
}

export const MoreGame: GameMode = {
    id: 'more', title: '更多玩法', desc: '敬请期待', badge: '+', maxPlayers: 0, isEnabled: false,
}

export const GAME_MODES: GameMode[] = [NineBallGame, EightBallGame, SnookerGame, MoreGame]

/** GameModeId -> MatchType 映射 */
export const GAME_MODE_TO_MATCH_TYPE: Record<GameModeId, MatchType> = {
    'nine-ball': '9ball',
    'eight-ball': '8ball',
    'snooker': 'snooker',
    'more': '9ball',
}

/** MatchType -> 中文名称映射 */
export const MATCH_TYPE_TEXT: Record<MatchType, string> = {
    'snooker': '斯诺克',
    '8ball': '八球',
    '9ball': '九球',
}

/** 筛选名称 -> MatchType 映射 */
export const FILTER_TYPE_MAP: Record<string, MatchType | undefined> = {
    '全部': undefined,
    '斯诺克': 'snooker',
    '九球': '9ball',
    '八球': '8ball',
}

/** 筛选标签 */
export const RECORD_FILTERS: string[] = ['全部', '斯诺克', '九球', '八球']
