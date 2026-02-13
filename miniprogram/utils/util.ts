/** 数字补零 */
const padNumber = (n: number): string => {
    const s = n.toString()
    return s.length >= 2 ? s : '0' + s
}

/** 格式化日期时间 */
export const formatTime = (date: Date): string => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()

    return (
        [year, month, day].map(padNumber).join('/') +
        ' ' +
        [hour, minute, second].map(padNumber).join(':')
    )
}

/** 格式化对局时间（不含秒） */
export const formatMatchTime = (time?: string): string => {
    if (!time) return '未知时间'
    const date = new Date(time)
    if (Number.isNaN(date.getTime())) return time
    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

/** 根据当前时间返回问候语 */
export const getGreeting = (): string => {
    const hour = new Date().getHours()
    if (hour < 6) return '凌晨好'
    if (hour < 12) return '早上好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
}
