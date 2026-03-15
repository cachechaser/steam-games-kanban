import { useSteam } from '@/composables/useSteam'
import {SteamGame} from "@/types/domain";

describe('useSteam API', () => {
  it('exposes typed state and methods', () => {
    const steam = useSteam()

    expect(steam.state.columns.length).toBeGreaterThan(0)
    expect(typeof steam.refreshLibrary).toBe('function')
    expect(typeof steam.getCompletionData).toBe('function')
  })

  it('computes completion data from achievement list', () => {
    const steam = useSteam()
      const mockGame: SteamGame = {
          appid: 1,
          name: 'x',
          status: 'Backlog',
          achievementsList: {
              achievements: [
                  { apiname: 'a', name: 'a', achieved: true },
                  { apiname: 'b', name: 'b', achieved: false }
              ]
          }
      }
      
    const data = steam.getCompletionData(mockGame)

    expect(data.total).toBe(2)
    expect(data.achieved).toBe(1)
  })
})

