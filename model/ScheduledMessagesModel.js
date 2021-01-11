const Model = require('./Model')

class ScheduledMessages extends Model {
  insertOne (data) {
    return super.insertOne('scheduledMessages', data)
  }
  find (query, options = {}) {
    return super.find('scheduledMessages', query, options)
  }
  deleteMany (query) {
    return super.deleteMany('scheduledMessages', query)
  }
}

module.exports = ScheduledMessages
