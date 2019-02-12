class MentionsController {
  constructor(
    $rootScope,
    MentionsService,
    $scope,
    MosaicsTilesService,
    $timeout,
    $uibModal,
    ModalsOptionsService,
    LocalUsersService
  ) {
    // Settings
    this.$rootScope = $rootScope
    this.MentionsService = MentionsService
    this.$scope = $scope
    this.MosaicsTilesService = MosaicsTilesService
    this.$timeout = $timeout
    this.$uibModal = $uibModal
    this.ModalsOptionsService = ModalsOptionsService
    this.LocalUsersService = LocalUsersService

    this.mentionsAll = []
    this.mentionsNotRead = []
    this.mentionsRead = []
    this.mentionsEnd = false
    this.mentionsLimit = 10

    this.desktopScope = null
  }

  $onInit() {
    /**
     * Start listened sockets when component is init
     */
    this.initSocketListeners()
  }

  /**
   * Listener socket events
   */
  initSocketListeners() {
    /**
     * Listener socket when got mention
     */
    this.$rootScope.$on('socket:newMention', (e, mention) => {
      this.mentionsNotRead.unshift(mention)
      this.mentionsAll.push(mention)

      // Add user to UserService for tracking user data
      this.LocalUsersService.addLocalUser(mention.user)
      this.updateScope()
    })

    /**
     * Listener socket when mention updated
     */
    this.$rootScope.$on('socket:updatedMention', (e, mention) => {
      const indexInNotRead = this.mentionsNotRead.findIndex(el => el._id === mention._id)

      if (indexInNotRead !== -1) {
        this.mentionsNotRead[indexInNotRead] = mention
      }

      const indexInRead = this.mentionsRead.findIndex(el => el._id === mention._id)

      if (indexInRead !== -1) {
        this.mentionsRead[indexInRead] = mention
      }

      const indexAll = this.mentionsAll.findIndex(el => el._id === mention._id)
      if (indexAll !== -1) {
        this.mentionsAll[indexInRead] = mention
      }

      this.updateScope()
    })

    /**
     * Listener socket when mention removed
     */
    this.$rootScope.$on('socket:removedMention', (e, mention) => {
      const indexInNotRead = this.mentionsNotRead.findIndex(el => el._id === mention._id)
      if (indexInNotRead !== -1) {
        this.mentionsNotRead.splice(indexInNotRead, 1)
      }

      const indexInRead = this.mentionsRead.findIndex(el => el._id === mention._id)
      if (indexInRead !== -1) {
        this.mentionsRead.splice(indexInRead, 1)
      }

      const indexAll = this.mentionsAll.findIndex(el => el._id === mention._id)
      if (indexAll !== -1) {
        this.mentionsAll.splice(indexAll, 1)
      }

      this.updateScope()
    })

    /**
     * Listener socket when mosaic removed
     */
    this.$rootScope.$on('socket:deleteMosaic', (e, data) => this.removeMentions(data))

    /**
     * Listener when local mosaic removed
     */
    this.$rootScope.$on('deleteMosaic', (e, data) => this.removeMentions(data))
  }

  /**
   * Removed mention
   * @param {object} mosaicId
   */
  removeMentions(data) {
    const { mosaicId } = data

    this.mentionsNotRead = this.mentionsNotRead.filter(el => el.belongsTo._id !== mosaicId)
    this.mentionsRead = this.mentionsRead.filter(el => el.belongsTo._id !== mosaicId)
    this.mentionsAll = this.mentionsAll.filter(el => el.belongsTo._id !== mosaicId)
  }

  /**
   * Open mosaic and select current tile with mention
   * @param {object} mention
   */
  goToTile(mention) {
    const mosaicId = mention.belongsTo._id
    const tileId = mention.belongsToTile

    // Open mosaic
    this.desktopScope.openShareModal(mosaicId)

    const mosaic = this.$rootScope.nestedDnDModels.selected
    const tile = mosaic.things.filter(el => el._id === tileId)

    // Select tile
    this.$timeout(() => {
      if (tile.length) {
        this.$rootScope.nestedDnDModels.selected = tile[0]
      }
    }, 500)

    // Scroll to tile
    this.$timeout(() => {
      const mosaicContainer = angular.element(`#mosaic_container_${mosaicId}`)
      const scrollingContainer = mosaicContainer.find('.container-element')
      scrollingContainer.scrollTop(0)

      const tileLi = $(`#${tileId}`)
      if (tileLi.position()) {
        const scrollPos = tileLi.position().top - 200
        scrollingContainer.animate({ scrollTop: scrollPos }, 'slow')
      }
    }, 500)
  }

  /**
   * Open shared modal and select collection if mention is exist
   * @param {object} mention
   */
  goToMessage(mention) {
    const mosaicId = mention.belongsTo._id
    const messageId = mention.belongsToTile

    this.desktopScope.openShareModal(mosaicId)
    this.$rootScope.$broadcast('goToMessage', messageId)
  }

  /**
   * Get all user mentions and set limit of mention
   * @param offset
   * @param limit
   */
  getMentions(offset = 0, limit = this.mentionsLimit) {
    if (!this.mentionsEnd) {
      this.MentionsService.getMentions(this.$rootScope.currentUser._id, offset, limit)
        .then(res => {
          this.mentionsAll = this.mentionsAll.concat(res.data.mentions)

          res.data.mentions.forEach(el => {
            if (!el.isRead) {
              this.mentionsNotRead.push(el)
            } else {
              this.mentionsRead.push(el)
            }

            // add local users for tracking user data
            this.LocalUsersService.addLocalUser(el.user)
          })

          if (!res.data.isMore) {
            this.mentionsEnd = true
          }
        })
        .catch(er => {
          console.error(er)
          this.mentionsEnd = true
        })
    }
  }

  /**
   * Load more than limited mention
   */
  loadMore() {
    if (this.mentionsAll.length) {
      this.getMentions(this.mentionsAll.length)
    }
  }

  /**
   * Mark all messages as read
   */
  markAllRead(event) {
    event.preventDefault()
    this.MentionsService.markAllRead(this.$rootScope.currentUser._id)
      .then(() => {
        this.mentionsNotRead.forEach(el => {
          el.isRead = true
        })
      })
      .catch(er => console.error(er))
  }

  /**
   * Mark message as read
   */
  readMention(mention) {
    this.MentionsService.readMention(mention._id)
      .then(() => {
        mention.isRead = true
      })
      .catch(er => console.error(er))
  }

  /**
   * Go to tile or message
   */
  goToItem(mention) {
    this.close()
    const mosaicId = mention.belongsTo._id

    if (!mention.isRead) {
      this.readMention(mention)
    }

    // Checking for the existence of a local mosaic and open the preview modal
    const mosaicExsist = this.MosaicsTilesService.getLocalMosaicById(mosaicId)
    if (!mosaicExsist) {
      this.$uibModal.open(this.ModalsOptionsService.getPreviewMosaicOptions(mosaicId))
      return
    }

    if (mention.subject === 'tile') {
      this.goToTile(mention)
    }

    if (mention.subject === 'message') {
      this.goToMessage(mention)
    }
  }

  /**
   * Define desktop $scope
   */
  initDesctopScope() {
    this.desktopScope = angular.element('#desktop').scope()
  }

  updateScope() {
    if (!this.$scope.$$phase) this.$scope.$apply()
  }

  /**
   * Getter of user authorization
   */
  get isLogged() {
    return this.isAuth
  }

  /**
   * Setter of user authorization
   */
  set isLogged(value) {
    this.isAuth = value

    if (!this.isAuth) {
      this.mentionsAll = []
      this.mentionsNotRead = []
      this.mentionsRead = []
      this.mentionsEnd = false
    }

    if (this.isAuth && this.$scope.$parent.isDesctop) {
      this.$timeout(() => {
        this.initDesctopScope()
        this.getMentions()
      }, 1000)
    }
  }

  /**
   * Close mention popup
   */
  close() {
    this.showNotification = false
  }
}

MentionsController.$inject = [
  '$rootScope',
  'MentionsService',
  '$scope',
  'MosaicsTilesService',
  '$timeout',
  '$uibModal',
  'ModalsOptionsService',
  'LocalUsersService'
]

angular.module('Memphis').component('mentions', {
  templateUrl: '/scripts/components/mentions/mentions.html',
  bindings: {
    showNotification: '=',
    isLogged: '<'
  },
  controller: MentionsController
})
