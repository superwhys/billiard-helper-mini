/** 首页 */
import { GAME_MODES, GAME_MODE_TO_MATCH_TYPE, MATCH_TYPE_TEXT } from '../../types/game'
import type { GameModeId, Match } from '../../types/game'
import { getCurrentUser } from '../../services/account'
import { getMatchList, createMatch } from '../../services/game'
import { userStore } from '../../stores/user'
import { gameStore } from '../../stores/game'
import { getGreeting, formatMatchTime } from '../../utils/util'

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
}

/** 将 Match 转为展示用 RecordItem */
function buildRecordItem(match: Match): RecordItem {
    const targetScore = match.config ? match.config.target_score : 0
    return {
        id: match.id,
        title: (match.name && match.name.trim()) || ('对局 #' + match.id),
        mode: match.match_type ? (MATCH_TYPE_TEXT[match.match_type] || '对局') : '对局',
        time: formatMatchTime(match.created_at),
        target: targetScore + ' 局',
        players: (match.players || []).map(function (player, index) {
            return {
                id: player.id || player.code || (index + 1),
                name: player.nick_name || ('玩家 ' + (index + 1)),
                score: 0,
            }
        }),
        status: match.status || 1,
    }
}

Component({
    data: {
        statusBarHeight: 0,
        greeting: '',
        userName: '游客',
        avatarText: '?',
        gameModes: GAME_MODES,
        activeModeId: 'nine-ball' as GameModeId,
        recentRecords: [] as RecordItem[],
        hasRecentRecords: false,
    },

    lifetimes: {
        attached() {
            const app = getApp<IAppOption>()
            this.setData({
                statusBarHeight: app.globalData.navBarHeight,
                greeting: getGreeting(),
            })
        },
    },

    pageLifetimes: {
        show() {
            this.loadData()
        },
    },

    methods: {
        /** 加载页面数据 */
        async loadData() {
            try {
                const results = await Promise.all([
                    getCurrentUser(),
                    getMatchList({ limit: 3 }),
                ])
                const profile = results[0]
                const matches = results[1]
                userStore.setProfile(profile)
                const records = matches.map(function (m) { return buildRecordItem(m) })
                this.setData({
                    userName: profile.name || '游客',
                    avatarText: (profile.name || '?').slice(0, 1),
                    recentRecords: records,
                    hasRecentRecords: records.length > 0,
                    greeting: getGreeting(),
                })
            } catch (err) {
                console.error('首页数据加载失败', err)
            }
        },

        /** 选择游戏模式 */
        handleSelectMode(e: WechatMiniprogram.TouchEvent) {
            const modeId = e.currentTarget.dataset.modeId as GameModeId
            if (!modeId) return
            const mode = GAME_MODES.find(function (m) { return m.id === modeId })
            if (!mode || !mode.isEnabled) return
            this.setData({ activeModeId: modeId })
        },

        /** 创建对局 */
        async handleCreateRoom() {
            var modeId = this.data.activeModeId
            var mode = null as typeof GAME_MODES[0] | null
            for (var i = 0; i < GAME_MODES.length; i++) {
                if (GAME_MODES[i].id === modeId) { mode = GAME_MODES[i]; break }
            }
            if (!mode || !mode.isEnabled) {
                wx.showToast({ title: '该玩法暂未开放', icon: 'none' })
                return
            }
            var matchType = GAME_MODE_TO_MATCH_TYPE[modeId]
            var userName = userStore.getName()
            try {
                var match = await createMatch({
                    match_type: matchType,
                    max_players: mode.maxPlayers,
                    name: userName + '的对局',
                    target_score: 5,
                    virtual_players: [{ nick_name: userName, type: 1 }],
                })
                gameStore.setCurrentMatch(match)
                wx.navigateTo({ url: '/pages/create-room/create-room?matchId=' + match.id })
            } catch (err) {
                console.error('创建对局失败', err)
                wx.showToast({ title: '创建失败', icon: 'none' })
            }
        },

        /** 跳转到对局记录 */
        handleGoRecords() {
            wx.switchTab({ url: '/pages/records/records' })
        },
    },
})
