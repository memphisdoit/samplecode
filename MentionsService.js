angular.module('Memphis').service('MentionsService', MentionsService)

MentionsService.$inject = [
  '$rootScope',
  'HttpService',
  'AuthService',
  'DeepCopyService',
  'UserService',
  'SocketService',
  '$http'
]

function MentionsService($rootScope, HttpService, AuthService, DeepCopyService, UserService, SocketService, $http) {
  let mentionsList = []
  const tempMentions = {}
  let isShowPopup = false
  /**
   * Get possible mentions list from backend
   * @param {string} query
   * @returns {*}
   */
  const getSupposedMentions = query => {
    const url = `/api/v1/mentions/findUser?name=${query}`

    return HttpService.get(url).then(response => {
      mentionsList = DeepCopyService.clone(response.data)
      return response
    })
  }
  /**
   * Initialize mentions
   * @param {string} id Input id
   * @param {Array} mentions Item mentions
   */
  const initItemMentions = (id, mentions) => {
    if (mentions && mentions.length) {
      tempMentions[id] = DeepCopyService.clone(mentions)
    } else {
      tempMentions[id] = []
    }
  }
  /**
   * Get and switch popup state
   * @param {boolean} state New popup state
   */
  const changePopupState = state => {
    isShowPopup = state
  }
  /**
   * Get popup state
   * @returns {boolean}
   */
  const getPopupState = () => isShowPopup
  /**
   * On mention selection from dropdown adds it to temp storage
   * @param {string} id Input id
   * @param {string} name Mention user name
   */
  const selectMention = (id, name) => {
    if (!tempMentions[id]) tempMentions[id] = []

    const selected = mentionsList.find(m => m.name === name)

    if (!tempMentions[id].some(temp => selected.name === temp.name)) {
      tempMentions[id].push(selected)
    }

    mentionsList = []
  }
  /**
   * Check if string contain mention
   * @param {string} string
   * @returns {RegExpMatchArray}
   */
  const matchMention = string => {
    if (!string) return

    const text = string.text || string.text === '' ? string.text : string
    const regex = /\B@\w+(?=)/gi
    return text.match(regex)
  }
  /**
   * Check for removed mentions
   * @param {string} id ObjectId
   * @param {Array} mentions Item mentions list
   * @returns {Array} Removed mentions
   */
  const checkForRemovedMentions = (id, mentions) =>
    mentions.filter(mention => !tempMentions[id].some(temp => mention.name === temp.name))
  /**
   * Check for new mentions
   * @param {string} id ObjectId
   * @param {Array} mentions Item mentions list
   * @returns {Array} New mentions
   */
  const checkForNewMentions = (id, mentions) =>
    tempMentions[id].filter(temp => !mentions.some(mention => mention.name === temp.name))
  /**
   * Filter temp mentions storage by string
   * @param id
   * @param string
   * @returns {Array} Filtered tempMentions
   */
  const checkMentions = (id, string) => {
    if (!string) return []

    return tempMentions[id].filter(temp => {
      const literal = `\\B@${temp.name}`
      const regex = new RegExp(literal, 'g')
      return regex.test(string)
    })
  }
  /**
   * Update item mentions on save
   * @param item
   * @param string
   * @param id
   * @param type
   * @param isNew
   * @returns {*}
   */
  const updateMentions = (item, string, id, type, isNew) => {
    if (!tempMentions[id]) tempMentions[id] = []

    tempMentions[id] = checkMentions(id, string)

    const tileMentions = item.mentions || []
    const removedMentions = checkForRemovedMentions(id, tileMentions)
    const addedMentions = checkForNewMentions(id, tileMentions)

    if (!isNew && (removedMentions.length || addedMentions.length)) {
      const userId = UserService.user._id

      SocketService.updateMentions(item, addedMentions, removedMentions, userId, type)
    }

    return tempMentions[id]
  }

  const getMentionsByString = (id, string) => {
    if (!tempMentions[id]) return []
    return checkMentions(id, string)
  }
  /**
   * Remove mentions if removed item
   * @param item
   * @param items
   */
  const removeMentionsOnRemoveItem = (item, items) => {
    if (items) {
      items.forEach(i => {
        if (i.mentions && i.mentions.length) {
          SocketService.removeMentions(i._id)
        }
      })
    } else if (item.mentions && item.mentions.length) {
      SocketService.removeMentions(item._id)
    }
  }
  /**
   * Move mentions to new collection on item move
   * @param item
   * @param newMosaic
   * @returns {*}
   */
  const transferMentions = (item, newMosaic) => {
    if (item.mentions && item.mentions.length) {
      SocketService.transferMentions(item._id, newMosaic._id, newMosaic.title)
    }
  }
  /**
   * Remove autocomplete library query
   * @param string
   * @returns {*}
   */
  const removeAtwhoQuery = string => {
    const regex = /<span class="atwho-query">(.*?)<\/span>/gi
    return string.replace(regex, (str, text) => text)
  }
  /**
   * Get mentions
   * @param userId
   * @param offset
   * @param limit
   * @returns {*}
   */
  const getMentions = (userId, offset = 0, limit = 10) => {
    const url = `/api/v1/mentions?userId=${userId}&offset=${offset}&limit=${limit}`
    return HttpService.get(url)
  }
  /**
   * Mark one mention like read
   * @param mentionId
   * @returns {HttpPromise|JQueryXHR|*|void}
   */
  const readMention = mentionId => {
    const url = '/api/v1/mentions/read'
    return $http.post(url, { mentionId })
  }
  /**
   * Mark all mentions like read
   * @param userId
   * @returns {HttpPromise|JQueryXHR|*|void}
   */
  const markAllRead = userId => {
    const url = '/api/v1/mentions/readAll'
    return $http.post(url, { userId })
  }

  return {
    initItemMentions,
    getSupposedMentions,
    changePopupState,
    getPopupState,
    selectMention,
    matchMention,
    updateMentions,
    removeMentionsOnRemoveItem,
    transferMentions,
    getMentions,
    readMention,
    markAllRead,
    removeAtwhoQuery,
    getMentionsByString
  }
}
