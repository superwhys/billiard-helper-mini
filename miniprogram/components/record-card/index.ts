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
        'players': function (players: Array<{ id: number | string; name: string; score: number; isWinner?: boolean }>) {
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

            // 查找胜者（仅已完成状态使用）
            var winner = null
            var otherNames: string[] = []
            for (var i = 0; i < players.length; i++) {
                if (players[i].isWinner) {
                    winner = players[i]
                    break
                }
            }
            if (!winner && players.length > 0) {
                winner = players[0]
            }
            if (winner) {
                for (var j = 0; j < players.length; j++) {
                    if (players[j].id !== winner.id) {
                        otherNames.push(players[j].name)
                    }
                }
            }
            this.setData({
                winnerPlayer: winner,
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
