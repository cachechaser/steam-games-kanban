import { shallowMount } from '@vue/test-utils'
import BaseOverlay from '@/components/ui/BaseOverlay.vue'
import GameIconImg from '@/components/ui/GameIconImg.vue'
import KanbanColumn from '@/components/ui/KanbanColumn.vue'
import ViewHeader from '@/components/ui/ViewHeader.vue'
import GameCard from '@/components/ui/GameCard.vue'
import AchievementTable from '@/components/AchievementTable.vue'
import RefreshStatusToast from '@/components/ui/RefreshStatusToast.vue'

describe('UI components', () => {
  it('renders BaseOverlay and emits close', async () => {
    const wrapper = shallowMount(BaseOverlay, {
      props: { show: true }
    })

    await wrapper.find('button.close-btn-abs').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders GameIconImg url', () => {
    const wrapper = shallowMount(GameIconImg, {
      props: { appid: 42, iconHash: 'abcd' }
    })

    expect(wrapper.find('img').attributes('src')).toContain('/42/abcd.jpg')
  })

  it('renders KanbanColumn title', () => {
    const wrapper = shallowMount(KanbanColumn, {
      props: { name: 'Backlog', count: 3 }
    })

    expect(wrapper.text()).toContain('Backlog')
    expect(wrapper.text()).toContain('3')
  })

  it('renders ViewHeader title', () => {
    const wrapper = shallowMount(ViewHeader, {
      props: { title: 'My Header' }
    })

    expect(wrapper.text()).toContain('My Header')
  })

  it('emits GameCard actions', async () => {
    const wrapper = shallowMount(GameCard, {
      props: {
        game: { appid: 1, name: 'Game', status: 'Backlog' },
        completionData: { total: 1, achieved: 0, error: null }
      }
    })

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('info')).toBeTruthy()
    expect(wrapper.emitted('hide')).toBeTruthy()
  })

  it('emits sort in AchievementTable', async () => {
    const wrapper = shallowMount(AchievementTable, {
      props: {
        achievements: [
          {
            appid: 1,
            apiname: 'ach',
            name: 'A',
            achieved: true,
            unlockPercentage: 10
          }
        ]
      }
    })

    await wrapper.find('th').trigger('click')
    expect(wrapper.emitted('sort')).toBeTruthy()
  })

  it('renders RefreshStatusToast progress', () => {
    const wrapper = shallowMount(RefreshStatusToast, {
      props: {
        status: {
          visible: true,
          phase: 'achievements',
          label: 'Refreshing Achievements 2/4',
          current: 2,
          total: 4,
          progress: 50
        }
      }
    })

    expect(wrapper.text()).toContain('Refreshing Achievements 2/4')
    expect(wrapper.find('.refresh-toast__fill').attributes('style')).toContain('width: 50%')
  })
})

