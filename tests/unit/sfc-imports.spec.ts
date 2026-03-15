import App from '@/App.vue'
import AchievementTable from '@/components/AchievementTable.vue'
import DataSyncOverlay from '@/components/DataSyncOverlay.vue'
import Footer from '@/components/Footer.vue'
import GameInfoComponent from '@/components/GameInfoComponent.vue'
import NavBar from '@/components/NavBar.vue'
import HideIcon from '@/components/icons/HideIcon.vue'
import InfoIcon from '@/components/icons/InfoIcon.vue'
import BaseOverlay from '@/components/ui/BaseOverlay.vue'
import GameCard from '@/components/ui/GameCard.vue'
import GameIconImg from '@/components/ui/GameIconImg.vue'
import KanbanColumn from '@/components/ui/KanbanColumn.vue'
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown.vue'
import ViewHeader from '@/components/ui/ViewHeader.vue'
import AchievementView from '@/components/views/AchievementView.vue'
import BoardView from '@/components/views/BoardView.vue'
import CompletionView from '@/components/views/CompletionView.vue'
import HomeView from '@/components/views/HomeView.vue'
import ProfileEditView from '@/components/views/ProfileEditView.vue'
import ProfileView from '@/components/views/ProfileView.vue'

describe('SFC module imports', () => {
  it('loads every Vue module', () => {
    const modules = [
      App,
      AchievementTable,
      DataSyncOverlay,
      Footer,
      GameInfoComponent,
      NavBar,
      HideIcon,
      InfoIcon,
      BaseOverlay,
      GameCard,
      GameIconImg,
      KanbanColumn,
      MultiSelectDropdown,
      ViewHeader,
      AchievementView,
      BoardView,
      CompletionView,
      HomeView,
      ProfileEditView,
      ProfileView
    ]

    expect(modules).toHaveLength(20)
    for (const mod of modules) {
      expect(mod).toBeTruthy()
    }
  })
})

