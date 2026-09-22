import { snookerBalls, type SnookerState } from '../types/snooker'

export function readSnookerState(snapshot?: unknown): SnookerState | undefined {
    const value = (snapshot as Record<string, unknown> | undefined)?._snooker
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object') throw new Error('台面状态异常，请刷新后重试')
    const state = value as Record<string, unknown>
    const numbers = [
        'red_count',
        'reds_remaining',
        'active_player_id',
        'break_score',
        'remaining_points',
    ]
    const stages = [...snookerBalls.map((ball) => ball.key), 'colour', 'respotted_black', 'done']
    if (
        numbers.some((key) => !Number.isInteger(state[key]) || Number(state[key]) < 0) ||
        Number(state.red_count) < 1 ||
        Number(state.red_count) > 15 ||
        Number(state.reds_remaining) > Number(state.red_count) ||
        !stages.includes(String(state.next_ball)) ||
        typeof state.can_undo !== 'boolean'
    ) {
        throw new Error('台面状态异常，请刷新后重试')
    }
    return value as SnookerState
}

export function isSnookerBallAllowed(key: string, state?: SnookerState) {
    if (!state) return true
    if (state.next_ball === 'colour') return key !== 'red'
    if (state.next_ball === 'respotted_black') return key === 'black'
    return key === state.next_ball
}

export function snookerTargetLabel(state?: SnookerState) {
    if (!state) return '手动记分'
    if (state.next_ball === 'colour')
        return state.reds_remaining ? '下一球：任选彩球' : '最后一颗红球后：任选彩球'
    if (state.next_ball === 'done') return '台面已清空，请结算本局'
    if (state.next_ball === 'respotted_black') return '平分重置黑球，请按现场结果选择击球球员'
    const name = snookerBalls.find((ball) => ball.key === state.next_ball)?.name
    return state.reds_remaining ? `下一球：${name}` : `清彩阶段：${name}`
}
