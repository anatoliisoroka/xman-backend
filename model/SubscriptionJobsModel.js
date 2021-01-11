const Model = require('./Model')

class SubscriptionJobs extends Model {
  insertOne (data) {
    return super.insertOne('subscriptionJobs', data)
  }
  deleteMany (query) {
    return super.deleteMany('subscriptionJobs', query)
  }
}

module.exports = SubscriptionJobs
