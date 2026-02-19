/** 对局详情页 */
import type { Match } from '../../../types/game'
import { MATCH_TYPE_TEXT } from '../../../types/game'
import { getMatchDetail } from '../../../apis/game'
import { formatMatchTime } from '../../../utils/util'

type PlayerItem = {
    id: number | string
    name: string
    tag: string
    scoreText: string
    isWinner: boolean
}

type TimelineItem = {
    title: string
    desc: string
    score: string
    muted: boolean
}

function calcTargetWin(totalRounds: number): number {
    return Math.floor((totalRounds + 1) / 2)
}

Page({
    data: {
        matchId: 0,
        isLoading: true,
        statusText: '未开始',
        titleText: '对局详情',
        matchTypeText: '--',
        targetScoreText: '--',
        startTimeText: '--',
        durationText: '--',
        tableText: '--',
        modeText: '--',
        ruleText: '--',
        breakText: '--',
        resultText: '--',
        players: [] as PlayerItem[],
        timelines: [] as TimelineItem[],
    },

    onLoad(options: Record<string, string>) {
        var matchId = Number(options.matchId || 0)
        if (!matchId) {
            this.setData({ isLoading: false })
            return
        }
        this.setData({ matchId: matchId })
        this.loadMatchDetail(matchId)
    },

    /** 加载对局详情 */
    async loadMatchDetail(matchId: number) {
        this.setData({ isLoading: true })
        try {
            var match = await getMatchDetail({ match_id: matchId })
            this.applyMatchDetail(match)
        } catch (err) {
            console.error('加载对局详情失败', err)
            wx.showToast({ title: '加载失败', icon: 'none' })
        } finally {
            this.setData({ isLoading: false })
        }
    },

    /** 将对局详情应用到页面 */
    applyMatchDetail(match: Match) {
        var titleText = (match.name || '').trim() || ('对局 #' + match.id)
        var matchTypeText = match.match_type ? (MATCH_TYPE_TEXT[match.match_type] || '对局') : '对局'
        var targetScore = match.config ? match.config.target_score : 0
        var targetScoreText = targetScore ? String(targetScore) : '--'
        var statusText = this.buildStatusText(match.status)
        var startTimeText = formatMatchTime(match.created_at)
        var modeText = matchTypeText
        if (match.match_type === '8ball' && targetScore) {
            var targetWin = calcTargetWin(targetScore)
            modeText = targetScore + '局' + targetWin + '胜'
        }

        var players = this.buildPlayerItems(match)
        var resultText = this.buildResultText(match, players, statusText)
        var timelines = this.buildTimelineItems(match, statusText)

        this.setData({
            titleText: titleText,
            statusText: statusText,
            matchTypeText: matchTypeText,
            targetScoreText: targetScoreText,
            startTimeText: startTimeText,
            modeText: modeText,
            ruleText: targetScore ? ('先到 ' + targetScore) : '--',
            breakText: '--',
            resultText: resultText,
            players: players,
            timelines: timelines,
        })
    },

    buildStatusText(status?: number): string {
        if (status === 2) return '进行中'
        if (status === 3) return '已完成'
        return '未开始'
    },

    buildResultText(match: Match, players: PlayerItem[], statusText: string): string {
        if (match.status !== 3) return statusText
        var winner = players.find(function (p) { return p.isWinner })
        if (!winner) return '已完成'
        return winner.name + ' 胜'
    },

    buildPlayerItems(match: Match): PlayerItem[] {
        var players = match.players || []
        if (!players.length) return []
        var winnerId = match.winner_id
        var scoreMap = match.current_scores || {}

        return players.map(function (player, index) {
            var id = player.id ?? player.code ?? (index + 1)
            var name = player.nick_name || ('玩家 ' + (index + 1))
            var isWinner = winnerId ? String(winnerId) === String(id) : false
            var scoreItem = (scoreMap as unknown as Record<string, { score: number }>)[String(id)]
            var scoreText = scoreItem && typeof scoreItem.score === 'number'
                ? String(scoreItem.score)
                : '--'
            return {
                id: id,
                name: name,
                tag: isWinner ? '胜者' : '参与',
                scoreText: scoreText,
                isWinner: isWinner,
            }
        })
    },

    buildTimelineItems(match: Match, statusText: string): TimelineItem[] {
        var round = match.match_round || 1
        return [
            {
                title: '当前回合 ' + round,
                desc: statusText,
                score: '--',
                muted: false,
            },
        ]
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        return {
            title: '台球计分助手 - 一起来打球吧',
            path: '/pages/home/home',
        }
    },
})
