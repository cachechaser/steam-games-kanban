# Steam Games Kanban

Your Steam library is likely a graveyard of unplayed titles (well at least mine is), impulse buys from summer and winter sales, forgotten gems, ...
\- It is time to bring order to the chaos.

Steam Games Kanban/Steam Backlog is a visual project management tool for your gaming life. It
transforms your static list of games into a dynamic, interactive board where you can track what
you are playing, what you want to play next, and what you have completed.

Stop scrolling listlessly through your library. Start completing your backlog.

## Features

- **Visual Workflow**: Drag and drop your games across customizable columns (Backlog, Playing,
  Completed, Shelved). Treat your gaming hobby like the serious project it is. **Note: Mobile
  needs some work.**
- **Hide Games you don't want to play**: Game is too tough to complete, achievements are
  impossible, servers are down or the game is just trash? Well, hide it application-wide! You can unhide them later.
- **Achievement Integration**: Automatically fetches your achievement progress for every game. See exactly how close you are to 100% completion without leaving the board.
- **Trophy Case**: A dedicated showcase for games you have perfected (100% achievements).
- **Privacy First**: All data, including your API key and board layout, is stored locally in your browser. No external servers track your gaming habits.

---

## Technical Setup

This template should help get you started developing with Vue 3 in Vite.

### Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

### Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
	- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
	- [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
	- [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
	- [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

### Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

### Project Setup

```sh
npm install
```

#### Compile and Hot-Reload for Development

```sh
npm run dev
```

#### Compile and Minify for Production

```sh
npm run build
```

---

## Roadmap and Next Steps

I have big plans to make this a useful tool for Steam power users. Here is what I have planned for the future:

### More filters, Integration and Data

- **HowLongToBeat Integration**: Pull estimated completion times for story/main/completionist runs directly onto the game card.
- **ProtonDB & Steam Deck Status**: Automatically tag games with their Steam Deck verification status (Verified, Playable, Unsupported) and ProtonDB rating.
- **Metacritic/SteamDB/Steam Store Scores**: Overlay review scores to help you decide which masterpiece to play next.
- **More pre-filtered dashboards**: Application sorts your library for you.
- [x] **Achievements-based dashboard**: Well, the current AchievementView will be renamed to CompletionView. Inspired by
  [Completionists Achievements Overview](https://completionist.me/steam/achievements) there will be a new dashboard
  that lists your achievements and sorts them by rarity, game completion percentage/status, or how long ago you earned
  them. This will help you find those rare achievements you forgot about and give you a new way to explore your
  gaming history. **Fun Fact**: This was the original motivation for this project because I have way too many locked
  achievements in games I don't even want to play anymore and I want to find a way to clear them out of my backlog.

### Social and Gamification

- **Spin the Wheel**: For the indecisive gamer, a feature that randomly selects a game from your "Backlog" column and forces you to play it.
- **Badges/Achievements**: Let's give us some additional motivation to grind for and display on your profile or rate our backlogs automatically.
- **More Stats**: Track your gaming habits with more detailed statistics.
- **The Buddy System**: Generate a read-only link to your board to share with friends, or compare your statistics side-by-side.
- **Challenge Mode**: Set a target date to finish a game. The card turns red as the deadline approaches.

### UI and Customization

- **Tags**: Add custom tags to your games (e.g., "Multiplayer", "Road to 100%") and filter/sort by them. Maybe even export/import steam collections to pre-populate them.
- **Swimlanes/Custom Boards**: Group your board horizontally by genre or tags.
- **Themes**: Switch between different themes to match your gaming vibe.
- **More filters**: Add more ways to sort and filter your games.
- **Better Mobile Support**: A responsive design that works well on phones and tablets, so you can check your backlog on the go.
- **Better UX for Large Libraries**: Implement features like pagination and bulk actions to manage large game libraries more efficiently.
- **Better UX in general**: Make the general user experience smoother and more intuitive to sort your games faster.

### Data Management

- **Export/Import**: Save your board layout and custom game statuses to a JSON file to transfer between devices or browsers.
- **Device Sync**: I don't want you to lose your board if you switch devices or clear your browser data. Implement a secure way to sync your data across devices without compromising privacy.
- **Steam Sync**: Stuff like collections are used to organize games on steam. There's not really a reason to have to re-organize them on the board. Syncing collections and tags from steam would be a nice quality of life improvement.

## Contributing

I welcome contributions from the community. Whether it is a bug fix, a new feature, or a design
improvement, feel free to help us clear the backlog.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
