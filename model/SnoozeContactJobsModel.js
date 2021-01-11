const Model = require('./Model')

class SnoozeContactJobs extends Model {
  insertOne (data) {
    return super.insertOne('snoozeContactJobs', data)
  }
  deleteMany (query) {
    return super.deleteMany('snoozeContactJobs', query)
  }
}

module.exports = SnoozeContactJobs
