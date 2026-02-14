/** 单次分数变动 */
export interface ScoreAction {
    player_ids: number[]
    score: number
}

/** 计分同步事件 */
export interface MatchScoreSyncEvent {
    operator_id: number
    match_id: number
    round: number
    score_actions: ScoreAction[]
    context?: Record<string, unknown>
}

/** 撤销计分请求 */
export interface MatchScoreUndoRequest {
    match_id: number
    round: number
}
