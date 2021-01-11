const Model = require('./Model')

class BroadcastJobs extends Model {
  findOne (query, options = {}) {
    return super.findOne('broadcastJobs', query, options)
  }
  insertOne (data) {
    return super.insertOne('broadcastJobs', data)
  }
  deleteMany (query) {
    return super.deleteMany('broadcastJobs', query)
  }
}

module.exports = BroadcastJobs
