import { ref } from 'vue'
import type { SteamGame } from '@/types/domain'
import type { AchievementTableRow } from '@/types/achievementTable'

/**
 * Composable for handling Steam CDN icon loading with fallback logic.
 * Provides fallback from primary Akamai CDN to Fastly shared CDN when primary fails.
 * Also used for game icons with primary and fallback URLs.
 */
export function useSteamIcon() {
  const gameIconAttempt = ref<Map<number, 'primary' | 'fallback'>>(new Map())

  /**
   * Get game icon URL with fallback support
   * Primary: //media.steampowered.com/steamcommunity/public/images/apps/{appid}/{icon_hash}.jpg
   * Fallback: https://shared.fastly.steamstatic.com/community_assets/images/apps/{appid}/{icon_hash}.jpg
   */
  const getGameIconUrl = (game: SteamGame, attempt: 'primary' | 'fallback' = 'primary'): string => {
    if (!game.img_icon_url) return '//placehold.co/64x64'

    if (attempt === 'primary') {
      return `//media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
    } else {
      return `https://shared.fastly.steamstatic.com/community_assets/images/apps/${game.appid}/${game.img_icon_url}.jpg`
    }
  }

  /**
   * Handle game icon load error - switch to fallback and force re-render
   */
  const handleGameIconError = (game: SteamGame, img: HTMLImageElement | null): void => {
    if (!img) return
    const attempt = gameIconAttempt.value.get(game.appid) ?? 'primary'
    if (attempt === 'primary') {
      gameIconAttempt.value.set(game.appid, 'fallback')
      img.src = getGameIconUrl(game, 'fallback')
    }
  }

  /**
   * Get achievement icon URL
   * Primary: https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/{appid}/{icon_url}.jpg
   * Already includes the .jpg extension in data or needs to be added
   */
  const getAchievementIconUrl = (ach: AchievementTableRow): string => {
    const url = ach.achieved ? ach.icon : (ach.iconGray || ach.icongray)
    if (!url) return ''
    if (url.startsWith('http')) return url
    return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${ach.appid}/${url}.jpg`
  }

  /**
   * Handle achievement icon load error - switch to fallback
   * Fallback: https://shared.fastly.steamstatic.com/community_assets/images/apps/{appid}/{icon_url}.jpg
   * This handles both the error event and DOM image load monitoring
   */
  const handleAchievementIconError = (ach: AchievementTableRow, img: HTMLImageElement | null): void => {
    if (!img) return

    const url = ach.achieved ? ach.icon : (ach.iconGray || ach.icongray)
    if (!url || url.startsWith('http')) return

    // Check if we already tried fallback
    if ((img.dataset && img.dataset.fallbackTried) === '1') return

    const fallbackUrl = `https://shared.fastly.steamstatic.com/community_assets/images/apps/${ach.appid}/${url}.jpg`
    if (img.dataset) img.dataset.fallbackTried = '1'
    img.src = fallbackUrl
  }

  /**
   * Monitor achievement image loads and apply fallback if needed
   * This ensures fallback is applied even if error event doesn't fire
   * Should be called from onMounted or when images are rendered
   */
  const monitorAchievementImages = (container: HTMLElement | null, achievements: AchievementTableRow[]): void => {
    if (!container) return

    const images = container.querySelectorAll('.ach-img') as NodeListOf<HTMLImageElement>
    
    // Set up IntersectionObserver to monitor when images come into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          // Image is in viewport, check if it failed to load
          setTimeout(() => {
            if (img.complete && img.naturalHeight === 0) {
              const achKey = img.dataset.achKey
              if (achKey) {
                const [appid, apiname] = achKey.split('-')
                const ach = achievements.find(a => a.appid.toString() === appid && a.apiname === apiname)
                if (ach) {
                  handleAchievementIconError(ach, img)
                }
              }
            }
          }, 100)
        }
      })
    }, { rootMargin: '50px' })

    images.forEach((img) => observer.observe(img))
  }

  return {
    getGameIconUrl,
    handleGameIconError,
    getAchievementIconUrl,
    handleAchievementIconError,
    monitorAchievementImages
  }
}
