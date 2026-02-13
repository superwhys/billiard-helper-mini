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
        statusClass: '',
    },

    observers: {
        'status': function (status: number) {
            const map: Record<number, { text: string; cls: string }> = {
                1: { text: '等待中', cls: 'status-waiting' },
                2: { text: '进行中', cls: 'status-playing' },
                3: { text: '已结束', cls: 'status-ended' },
            }
            const info = map[status] || { text: '未知', cls: '' }
            this.setData({ statusText: info.text, statusClass: info.cls })
        },
    },

    methods: {
        onTap() {
            this.triggerEvent('tap', { recordId: this.data.recordId })
        },
    },
})
