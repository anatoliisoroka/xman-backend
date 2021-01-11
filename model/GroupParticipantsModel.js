const Model = require('./Model')

class GroupParticipants extends Model {
  find (query, options = {}) {
    return super.find('groupParticipants', query, options)
  }
  deleteMany (query) {
    return super.deleteMany('groupParticipants', query)
  }
}

module.exports = GroupParticipants
