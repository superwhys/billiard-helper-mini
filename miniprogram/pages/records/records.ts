/** 对局记录页 */
import { RECORD_FILTERS, FILTER_TYPE_MAP, MATCH_TYPE_TEXT } from '../../types/game'
import type { Match, MatchType } from '../../types/game'
import { getMatchList, deleteMatch } from '../../apis/game'
import { gameStore } from '../../stores/game'
import { snookerFrameWins } from '../../utils/match'
import { formatMatchTime } from '../../utils/util'

/** MatchType -> 游戏页面路由 */
var MATCH_TYPE_GAME_ROUTES: Record<string, string> = {
    '9ball': '/package-game/pages/nine-ball-game/nine-ball-game',
    '8ball': '/package-game/pages/eight-ball-game/eight-ball-game',
    'snooker': '/package-game/pages/snooker-game/snooker-game',
}

interface RecordPlayer {
    id: number | string
    name: string
    score: number
}

interface RecordItem {
    id: number
    title: string
    mode: string
    time: string
    target: string
    players: RecordPlayer[]
    status: number
    winnerId?: number
    winnerScore?: number
    matchType?: MatchType
}

const PAGE_SIZE = 10

/** 将 Match 转为展示用 RecordItem */
function buildRecordItem(match: Match, fallbackType?: MatchType): RecordItem {
    const targetScore = match.config ? match.config.target_score : 0
    var modeText = '对局'
    if (match.match_type) {
        modeText = MATCH_TYPE_TEXT[match.match_type] || '对局'
    } else if (fallbackType) {
        modeText = MATCH_TYPE_TEXT[fallbackType] || '对局'
    }

    return {
        id: match.id,
        title: (match.name && match.name.trim()) || ('对局 #' + match.id),
        mode: modeText,
        time: formatMatchTime(match.created_at),
        target: match.match_type === 'snooker'
            ? targetScore + ' 局 ' + (Math.floor(targetScore / 2) + 1) + ' 胜'
            : targetScore + ' 局',
        players: (match.players || []).map(function (player, index) {
            return {
                id: player.id || player.code || (index + 1),
                name: player.nick_name || ('玩家 ' + (index + 1)),
                score: match.match_type === 'snooker' ? snookerFrameWins(match, player.id || 0) : 0,
            }
        }),
        status: match.status || 1,
        winnerId: match.winner_id,
        winnerScore: match.winner_score,
        matchType: match.match_type,
    }
}

Page({
    data: {
        filters: RECORD_FILTERS,
        activeFilterIndex: 0,
        recordList: [] as RecordItem[],
        hasRecords: false,
        isLoading: false,
        isRefreshing: false,
        hasMore: true,
        cursor: null as number | null,
        showDeleteModal: false,
        deletingId: null as number | null,
        isDeleting: false,
    },

    _matchMap: {} as Record<number, Match>,

    onShow() {
        this.loadRecords(true)
    },

    /** 加载记录 */
    async loadRecords(isReset?: boolean) {
        if (this.data.isLoading) return
        if (isReset) {
            this.setData({ cursor: null, hasMore: true, recordList: [], hasRecords: false })
        }
        if (!this.data.hasMore) return

        const selectedFilter = this.data.filters[this.data.activeFilterIndex] || '全部'
        const matchType = FILTER_TYPE_MAP[selectedFilter]

        this.setData({ isLoading: true })
        if (isReset) { this._matchMap = {} }
        try {
            const matches = await getMatchList({
                match_type: matchType,
                limit: PAGE_SIZE,
                cursor: this.data.cursor || undefined,
            })
            for (var i = 0; i < matches.length; i++) {
                this._matchMap[matches[i].id] = matches[i]
            }
            const nextItems = matches.map(function (m) { return buildRecordItem(m, matchType) })
            const list = isReset ? nextItems : ([] as RecordItem[]).concat(this.data.recordList, nextItems)
            const lastMatch = matches[matches.length - 1]

            this.setData({
                recordList: list,
                hasRecords: list.length > 0,
                hasMore: matches.length >= PAGE_SIZE,
                cursor: lastMatch ? lastMatch.id : this.data.cursor,
            })
        } catch (err) {
            console.error('加载记录失败', err)
            if (isReset) {
                this.setData({ recordList: [], hasRecords: false })
            }
            this.setData({ hasMore: false })
        } finally {
            this.setData({ isLoading: false })
        }
    },

    /** 切换筛选标签 */
    handleFilterChange(e: WechatMiniprogram.TouchEvent) {
        const index = e.currentTarget.dataset.index as number
        if (index === this.data.activeFilterIndex) return
        this.setData({ activeFilterIndex: index })
        this.loadRecords(true)
    },

    /** 触底加载更多 */
    handleScrollToLower() {
        if (!this.data.isLoading && this.data.hasMore) {
            this.loadRecords()
        }
    },

    /** 下拉刷新 */
    async handleRefresh() {
        if (this.data.isRefreshing) return
        this.setData({ isRefreshing: true })
        try {
            await this.loadRecords(true)
        } finally {
            this.setData({ isRefreshing: false })
        }
    },

    /** 点击对局记录卡片，根据状态跳转 */
    handleRecordTap(e: WechatMiniprogram.CustomEvent<{ recordId: number }>) {
        var recordId = e.detail.recordId
        if (!recordId) return

        var record: RecordItem | null = null
        for (var i = 0; i < this.data.recordList.length; i++) {
            if (this.data.recordList[i].id === recordId) {
                record = this.data.recordList[i]
                break
            }
        }
        if (!record) return

        if (record.status === 1) {
            var match = this._matchMap[recordId]
            if (match) { gameStore.setCurrentMatch(match) }
            wx.navigateTo({ url: '/package-game/pages/create-room/create-room?matchId=' + recordId })
            return
        }

        if (record.status === 2) {
            var route = record.matchType ? MATCH_TYPE_GAME_ROUTES[record.matchType] : null
            if (!route) {
                wx.showToast({ title: '该玩法暂未支持', icon: 'none' })
                return
            }
            wx.navigateTo({ url: route + '?matchId=' + recordId })
            return
        }

        wx.navigateTo({ url: '/package-record/pages/record-detail/record-detail?matchId=' + recordId })
    },

    /** 长按显示删除确认 */
    handleLongPress(e: WechatMiniprogram.TouchEvent) {
        const recordId = e.currentTarget.dataset.recordId as number
        if (!recordId || this.data.isDeleting) return
        this.setData({ showDeleteModal: true, deletingId: recordId })
    },

    /** 关闭删除弹窗 */
    handleCloseDelete() {
        if (this.data.isDeleting) return
        this.setData({ showDeleteModal: false, deletingId: null })
    },

    /** 确认删除 */
    async handleConfirmDelete() {
        const matchId = this.data.deletingId
        if (!matchId || this.data.isDeleting) return

        this.setData({ isDeleting: true })
        try {
            await deleteMatch({ match_id: matchId })
            const list = this.data.recordList.filter(function (r) { return r.id !== matchId })
            this.setData({
                recordList: list,
                hasRecords: list.length > 0,
            })
            wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
            console.error('删除失败', err)
            wx.showToast({ title: (err as Error).message || '删除失败', icon: 'none' })
        } finally {
            this.setData({ isDeleting: false, showDeleteModal: false, deletingId: null })
        }
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        return {
            title: '台球计分助手 - 一起来打球吧',
            path: '/pages/home/home',
        }
    },
})
