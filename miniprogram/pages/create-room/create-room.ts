/** 创建/编辑对局页面 */
import { GAME_MODES, NineBallGame } from '../../types/game'
import type { GameModeId, Match } from '../../types/game'
import { nineBallScoreKeys, nineBallScoreLabels, extractNineBallScores } from '../../types/nineball'
import { updateMatch, joinMatch, leaveMatch, startMatch, deleteMatch } from '../../services/game'
import { gameStore } from '../../stores/game'

var matchTypeToModeMap: Record<string, GameModeId> = {
    '9ball': 'nine-ball',
    '8ball': 'eight-ball',
    'snooker': 'snooker',
}

var matchTypeToRouteMap: Record<string, string> = {
    '9ball': '/pages/nine-ball-game/nine-ball-game',
    '8ball': '/pages/eight-ball-game/eight-ball-game',
}

var randomNameAdjectives = ['旋风', '雷霆', '追风', '破浪', '夜影', '疾光', '星河', '流火', '晨曦', '暮影']
var randomNameNouns = ['球手', '球侠', '猎手', '行者', '之刃', '之星', '战将', '逐影', '破阵', '飞影']

function buildRandomPlayerName(existingNames: string[], fallbackId: number): string {
    var existingSet: Record<string, boolean> = {}
    for (var i = 0; i < existingNames.length; i++) {
        var n = existingNames[i].trim()
        if (n) { existingSet[n] = true }
    }
    for (var attempt = 0; attempt < 6; attempt++) {
        var adj = randomNameAdjectives[Math.floor(Math.random() * randomNameAdjectives.length)]
        var noun = randomNameNouns[Math.floor(Math.random() * randomNameNouns.length)]
        var candidate = adj + noun
        if (!existingSet[candidate]) { return candidate }
    }
    return '玩家 ' + fallbackId
}

interface RoomPlayer {
    id: number
    nick_name: string
    player_code: string
}

Page({
    data: {
        matchId: 0,
        matchIdText: '--',
        modeBadge: '-',
        modeTitle: '桌球对局',
        modeDesc: '标准计分',
        modeMaxPlayers: 4,
        modeMeta: '最多 4 人',
        isNineBall: true,
        roomName: '',
        targetScore: 5,
        targetOptions: [3, 5, 7, 9],
        scoreConfigExpanded: false,
        scoreItems: [] as Array<{ key: string; label: string; value: number }>,
        players: [] as RoomPlayer[],
        canAddPlayer: true,
        canDeletePlayer: false,
        swipedPlayerId: 0,
        showAddModal: false,
        addingName: '',
        showEditModal: false,
        editingPlayerId: 0,
        editingName: '',
        editingOriginalName: '',
        showDeleteModal: false,
        isDeletingMatch: false,
    },

    // ===== 滑动手势 =====

    _touchStartX: 0,
    _touchStartY: 0,

    onPlayerTouchStart(e: WechatMiniprogram.TouchEvent) {
        this._touchStartX = e.touches[0].clientX
        this._touchStartY = e.touches[0].clientY
    },

    onPlayerTouchEnd(e: WechatMiniprogram.TouchEvent) {
        var endX = e.changedTouches[0].clientX
        var endY = e.changedTouches[0].clientY
        var deltaX = endX - this._touchStartX
        var deltaY = endY - this._touchStartY
        var playerId = Number(e.currentTarget.dataset.playerId)

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            if (deltaX < 0 && this.data.canDeletePlayer) {
                this.setData({ swipedPlayerId: playerId })
            } else {
                this.setData({ swipedPlayerId: 0 })
            }
        }
    },

    handleCloseSwipe() {
        if (this.data.swipedPlayerId) {
            this.setData({ swipedPlayerId: 0 })
        }
    },

    onLoad(options: Record<string, string>) {
        var matchId = Number(options.matchId || 0)
        var match = gameStore.getCurrentMatch()
        if (!match || match.id !== matchId) {
            wx.showToast({ title: '对局不存在', icon: 'none' })
            setTimeout(function () { wx.navigateBack() }, 300)
            return
        }
        this.applyMatchToForm(match)
    },

    /** 将对局数据应用到表单 */
    applyMatchToForm(match: Match) {
        var modeId = matchTypeToModeMap[match.match_type] || 'nine-ball'
        var mode = null as typeof NineBallGame | null
        for (var i = 0; i < GAME_MODES.length; i++) {
            if (GAME_MODES[i].id === modeId) { mode = GAME_MODES[i]; break }
        }
        if (!mode) { mode = NineBallGame }

        var playerList: RoomPlayer[] = (match.players || []).map(function (p, idx) {
            return {
                id: p.id || (idx + 1),
                nick_name: p.nick_name || ('玩家 ' + (idx + 1)),
                player_code: p.code || '',
            }
        })

        var isNineBall = modeId === 'nine-ball'
        var scoreItems: Array<{ key: string; label: string; value: number }> = []
        if (isNineBall) {
            var configData = (match.config && match.config.data) ? match.config.data : undefined
            var scores = extractNineBallScores(configData)
            for (var j = 0; j < nineBallScoreKeys.length; j++) {
                var sk = nineBallScoreKeys[j]
                scoreItems.push({ key: sk, label: nineBallScoreLabels[sk], value: scores[sk] })
            }
        }

        this.setData({
            matchId: match.id,
            matchIdText: '#' + match.id,
            modeBadge: mode.badge,
            modeTitle: mode.title,
            modeDesc: mode.desc,
            modeMaxPlayers: mode.maxPlayers,
            modeMeta: '最多 ' + mode.maxPlayers + ' 人',
            isNineBall: isNineBall,
            roomName: (match.name || '').trim(),
            targetScore: match.config ? match.config.target_score : 5,
            scoreItems: scoreItems,
            players: playerList,
            canAddPlayer: playerList.length < mode.maxPlayers,
            canDeletePlayer: playerList.length > 1,
        })
    },

    // ===== 目标局数 =====

    handleSelectTarget(e: WechatMiniprogram.TouchEvent) {
        var option = Number(e.currentTarget.dataset.option)
        if (!option || option <= 0) { return }
        this.setData({ targetScore: option })
        this.updateMatchIfChanged()
    },

    handleTargetInput(e: WechatMiniprogram.Input) {
        var value = Number(e.detail.value)
        if (value > 0) { this.setData({ targetScore: value }) }
    },

    handleTargetBlur() {
        this.updateMatchIfChanged()
    },

    // ===== 房间名称 =====

    handleNameInput(e: WechatMiniprogram.Input) {
        this.setData({ roomName: e.detail.value })
    },

    handleNameBlur() {
        this.updateMatchIfChanged()
    },

    // ===== 分数配置 =====

    handleToggleScoreConfig() {
        this.setData({ scoreConfigExpanded: !this.data.scoreConfigExpanded })
    },

    handleScoreInput(e: WechatMiniprogram.Input) {
        var key = String(e.currentTarget.dataset.key || '')
        var value = Number(e.detail.value)
        if (!key) { return }
        var items = this.data.scoreItems.slice()
        for (var i = 0; i < items.length; i++) {
            if (items[i].key === key) {
                items[i] = { key: items[i].key, label: items[i].label, value: isFinite(value) ? value : 0 }
                break
            }
        }
        this.setData({ scoreItems: items })
    },

    handleScoreBlur() {
        this.updateMatchIfChanged()
    },

    // ===== 更新对局 =====

    async updateMatchIfChanged() {
        var matchId = this.data.matchId
        if (!matchId) { return }
        var name = this.data.roomName.trim()
        var target = this.data.targetScore
        if (!name || target <= 0) { return }
        var configData: Record<string, unknown> | undefined
        if (this.data.isNineBall && this.data.scoreItems.length > 0) {
            configData = {}
            for (var i = 0; i < this.data.scoreItems.length; i++) {
                var item = this.data.scoreItems[i]
                configData[item.key] = item.value
            }
        }
        try {
            var match = await updateMatch({ match_id: matchId, name: name, target_score: target, config_data: configData })
            gameStore.setCurrentMatch(match)
        } catch (err) {
            console.error('更新对局失败', err)
        }
    },

    // ===== 添加球员 =====

    handleOpenAdd() {
        if (!this.data.canAddPlayer) { return }
        var names = this.data.players.map(function (p) { return p.nick_name })
        var nextId = this.data.players.length + 1
        var defaultName = buildRandomPlayerName(names, nextId)
        this.setData({ showAddModal: true, addingName: defaultName })
    },

    handleCloseAdd() {
        this.setData({ showAddModal: false, addingName: '' })
    },

    handleAddNameInput(e: WechatMiniprogram.Input) {
        this.setData({ addingName: e.detail.value })
    },

    async handleConfirmAdd() {
        var matchId = this.data.matchId
        if (!matchId) { return }
        var name = this.data.addingName.trim()
        if (!name) {
            wx.showToast({ title: '请输入球员名称', icon: 'none' })
            return
        }
        try {
            var match = await joinMatch({ match_id: matchId, nick_name: name, player_type: 1 })
            gameStore.setCurrentMatch(match)
            this.applyMatchToForm(match)
            this.setData({ showAddModal: false, addingName: '' })
        } catch (err) {
            console.error('添加球员失败', err)
            wx.showToast({ title: (err as Error).message || '添加失败', icon: 'none' })
        }
    },

    // ===== 编辑球员 =====

    handleOpenEdit(e: WechatMiniprogram.TouchEvent) {
        var playerId = Number(e.currentTarget.dataset.playerId)
        var playerName = String(e.currentTarget.dataset.playerName || '')
        this.setData({
            showEditModal: true,
            editingPlayerId: playerId,
            editingName: playerName,
            editingOriginalName: playerName,
        })
    },

    handleCloseEdit() {
        this.setData({ showEditModal: false, editingPlayerId: 0, editingName: '', editingOriginalName: '' })
    },

    handleEditNameInput(e: WechatMiniprogram.Input) {
        this.setData({ editingName: e.detail.value })
    },

    handleSaveEdit() {
        var playerId = this.data.editingPlayerId
        if (!playerId) { this.handleCloseEdit(); return }
        var name = this.data.editingName.trim() || this.data.editingOriginalName
        var players = this.data.players.slice()
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === playerId) {
                players[i] = { id: players[i].id, nick_name: name, player_code: players[i].player_code }
                break
            }
        }
        this.setData({ players: players })
        this.handleCloseEdit()
    },

    // ===== 删除球员 =====

    async handleDeletePlayer(e: WechatMiniprogram.TouchEvent) {
        if (!this.data.canDeletePlayer) { return }
        var playerId = Number(e.currentTarget.dataset.playerId)
        var player: RoomPlayer | null = null
        for (var i = 0; i < this.data.players.length; i++) {
            if (this.data.players[i].id === playerId) { player = this.data.players[i]; break }
        }
        if (!player) { return }

        this.setData({ swipedPlayerId: 0 })
        var matchId = this.data.matchId
        if (matchId && player.player_code) {
            try {
                var match = await leaveMatch({ match_id: matchId, player_code: player.player_code })
                gameStore.setCurrentMatch(match)
                this.applyMatchToForm(match)
            } catch (err) {
                console.error('删除球员失败', err)
                wx.showToast({ title: (err as Error).message || '删除失败', icon: 'none' })
            }
        } else {
            var filtered = this.data.players.filter(function (p) { return p.id !== playerId })
            this.setData({
                players: filtered,
                canAddPlayer: filtered.length < this.data.modeMaxPlayers,
                canDeletePlayer: filtered.length > 1,
            })
        }
    },

    // ===== 开始对局 =====

    async handleStartGame() {
        var matchId = this.data.matchId
        if (!matchId) { return }
        await this.updateMatchIfChanged()
        try {
            var match = await startMatch({ match_id: matchId })
            if (match) {
                gameStore.setCurrentMatch(match)
            }
            var matchType = match?.match_type
                || gameStore.getCurrentMatch()?.match_type
                || '9ball'
            var route = matchTypeToRouteMap[matchType] || '/pages/nine-ball-game/nine-ball-game'
            wx.redirectTo({ url: route + '?matchId=' + matchId })
        } catch (err) {
            console.error('开始对局失败', err)
            wx.showToast({ title: (err as Error).message || '开始失败', icon: 'none' })
        }
    },

    // ===== 删除对局 =====

    handleOpenDeleteMatch() {
        if (this.data.isDeletingMatch) { return }
        this.setData({ showDeleteModal: true })
    },

    handleCloseDeleteMatch() {
        if (this.data.isDeletingMatch) { return }
        this.setData({ showDeleteModal: false })
    },

    async handleConfirmDeleteMatch() {
        var matchId = this.data.matchId
        if (!matchId || this.data.isDeletingMatch) { return }
        this.setData({ isDeletingMatch: true })
        try {
            await deleteMatch({ match_id: matchId })
            gameStore.clearCurrentMatch()
            wx.navigateBack()
        } catch (err) {
            console.error('删除对局失败', err)
            wx.showToast({ title: (err as Error).message || '删除失败', icon: 'none' })
        }
        this.setData({ isDeletingMatch: false, showDeleteModal: false })
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        var title = this.data.roomName
            ? this.data.roomName + ' - 来一起打球吧'
            : '台球计分助手 - 一起来打球吧'
        return {
            title: title,
            path: '/pages/home/home',
        }
    },
})
