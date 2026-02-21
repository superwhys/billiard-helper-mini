let resolveLoginReady: (() => void) | null = null
const loginReady = new Promise<void>((resolve) => {
    resolveLoginReady = resolve
})

export function markLoginReady() {
    if (!resolveLoginReady) return
    resolveLoginReady()
    resolveLoginReady = null
}

export function waitLoginReady() {
    return loginReady
}
