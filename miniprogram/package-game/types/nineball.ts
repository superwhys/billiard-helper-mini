/** 九球分数配置类型 */
export type NineBallScoreKey = 'big' | 'small' | 'golden' | 'win' | 'foul'
export type NineBallScores = Record<NineBallScoreKey, number>

export var nineBallScoreKeys: NineBallScoreKey[] = ['big', 'small', 'golden', 'win', 'foul']

export var nineBallScoreLabels: Record<NineBallScoreKey, string> = {
    big: '大金',
    small: '小金',
    golden: '黄金九',
    win: '普胜',
    foul: '犯规',
}

export var defaultNineBallScores: NineBallScores = {
    big: 10,
    small: 7,
    golden: 4,
    win: 4,
    foul: -1,
}

/** 从对局 config.data 中提取九球分数 */
export function extractNineBallScores(data?: Record<string, unknown>): NineBallScores {
    var result: NineBallScores = {
        big: defaultNineBallScores.big,
        small: defaultNineBallScores.small,
        golden: defaultNineBallScores.golden,
        win: defaultNineBallScores.win,
        foul: defaultNineBallScores.foul,
    }
    if (!data) { return result }
    for (var i = 0; i < nineBallScoreKeys.length; i++) {
        var key = nineBallScoreKeys[i]
        var value = data[key]
        if (typeof value === 'number' && isFinite(value)) {
            result[key] = value
        }
    }
    return result
}
