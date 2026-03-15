import { copyToClipboard } from '@/utils/clipboard'

describe('copyToClipboard', () => {
  it('uses navigator clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    const execSpy = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      value: execSpy,
      configurable: true
    })

    await expect(copyToClipboard('fallback')).resolves.toBe(true)
    expect(execSpy).toHaveBeenCalledWith('copy')

    expect(execSpy).toHaveBeenCalledWith('copy')
  })
})


