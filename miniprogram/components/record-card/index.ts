/** 对局记录卡片组件 */
Component({
    properties: {
        recordId: { type: Number, value: 0 },
        title: { type: String, value: '' },
        mode: { type: String, value: '' },
        time: { type: String, value: '' },
        target: { type: String, value: '' },
        players: { type: Array, value: [] },
        status: { type: Number, value: 1 },
        winnerId: { type: Number, value: 0 },
        winnerScore: { type: Number, value: 0 },
    },

    data: {
        statusText: '',
        isFinished: false,
        winnerPlayer: null as WechatMiniprogram.IAnyObject | null,
        otherNamesText: '',
        allPlayerNamesText: '暂无球员',
    },

    observers: {
        'status': function (status: number) {
            var text = '未开始'
            if (status === 2) text = '进行中'
            else if (status === 3) text = '已完成'
            this.setData({
                statusText: text,
                isFinished: status === 3,
            })
        },
        'players,winnerId,winnerScore': function (
            players: Array<{ id: number | string; name: string; score: number; isWinner?: boolean }>,
            winnerId: number,
            winnerScore: number,
        ) {
            if (!players || players.length === 0) {
                this.setData({
                    winnerPlayer: null,
                    otherNamesText: '',
                    allPlayerNamesText: '暂无球员',
                })
                return
            }

            var allNames = players.map(function (p) { return p.name }).join('、')
            this.setData({ allPlayerNamesText: allNames })

            // 查找胜者（优先使用 winnerId）
            var winner = null
            if (winnerId) {
                for (var i = 0; i < players.length; i++) {
                    if (String(players[i].id) === String(winnerId)) {
                        winner = players[i]
                        break
                    }
                }
            }
            if (!winner) {
                for (var k = 0; k < players.length; k++) {
                    if (players[k].isWinner) {
                        winner = players[k]
                        break
                    }
                }
            }
            var otherNames: string[] = []
            if (!winner && players.length > 0) {
                winner = players[0]
            }
            if (winner) {
                var winnerWithScore = winner
                if (typeof winnerScore === 'number' && winnerScore > 0) {
                    winnerWithScore = Object.assign({}, winner, { score: winnerScore })
                }
                for (var j = 0; j < players.length; j++) {
                    if (String(players[j].id) !== String(winner.id)) {
                        otherNames.push(players[j].name)
                    }
                }
                this.setData({
                    winnerPlayer: winnerWithScore,
                    otherNamesText: otherNames.length > 0 ? otherNames.join('、') : '暂无其他球员',
                })
                return
            }
            this.setData({
                winnerPlayer: null,
                otherNamesText: otherNames.length > 0 ? otherNames.join('、') : '暂无其他球员',
            })
        },
    },

    methods: {
        onTap() {
            this.triggerEvent('tap', { recordId: this.data.recordId })
        },
    },
})
