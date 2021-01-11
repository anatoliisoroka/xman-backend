const Model = require('./Model')

class GroupConversations extends Model {
  find (query, options = {}) {
    return super.find('groupConversations', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('groupConversations', query, options)
  }
  insertOne (data) {
    return super.insertOne('groupConversations', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('groupConversations', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('groupConversations', query, data)
  }
  deleteMany (query) {
    return super.deleteMany('groupConversations', query)
  }
}

module.exports = GroupConversations
