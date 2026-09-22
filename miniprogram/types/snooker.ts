export interface SnookerState {
    red_count: number
    reds_remaining: number
    next_ball:
        | 'red'
        | 'colour'
        | 'yellow'
        | 'green'
        | 'brown'
        | 'blue'
        | 'pink'
        | 'black'
        | 'respotted_black'
        | 'done'
    active_player_id: number
    break_score: number
    remaining_points: number
    can_undo: boolean
}

export const snookerBalls = [
    { key: 'red', name: '红球', points: 1, color: '#df454b' },
    { key: 'yellow', name: '黄球', points: 2, color: '#e5c148' },
    { key: 'green', name: '绿球', points: 3, color: '#4baf72' },
    { key: 'brown', name: '棕球', points: 4, color: '#a37351' },
    { key: 'blue', name: '蓝球', points: 5, color: '#548fe4' },
    { key: 'pink', name: '粉球', points: 6, color: '#e794b2' },
    { key: 'black', name: '黑球', points: 7, color: '#202727' },
] as const

export const maximumSnookerBreak = (redCount: number) => redCount * 8 + 27
