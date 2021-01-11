const Model = require('./Model')

class Subscriptions extends Model {
  find (query) {
    return super.find('subscriptions', query)
  }
  findOne (query, options = {}) {
    return super.findOne('subscriptions', query, options)
  }
  insertOne (data) {
    return super.insertOne('subscriptions', data)
  }
  deleteOne (query) {
    return super.deleteOne('subscriptions', query)
  }
  deleteMany (query) {
    return super.deleteMany('subscriptions', query)
  }
}

module.exports = Subscriptions
