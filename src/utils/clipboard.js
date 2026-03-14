/**
 * Copy text to clipboard with a fallback for insecure contexts (HTTP, iframes, etc.).
 * Returns true on success, false on failure.
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    // Try the modern Clipboard API first
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch {
            // Falls through to legacy fallback
        }
    }

    // Legacy fallback using a hidden textarea + execCommand
    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        // Prevent scroll jump
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        return ok
    } catch {
        return false
    }
}

