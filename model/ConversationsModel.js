const Model = require('./Model')

class Conversations extends Model {
  find (query, options = {}) {
    return super.find('conversations', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('conversations', query, options)
  }
  count (query) {
    return super.count('conversations', query)
  }
  insertOne (data) {
    return super.insertOne('conversations', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('conversations', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('conversations', query, data)
  }
  deleteMany (query) {
    return super.deleteMany('conversations', query)
  }
}

module.exports = Conversations
