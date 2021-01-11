const Model = require('./Model')

class Broadcasts extends Model {
  find (query, options = {}) {
    return super.find('broadcasts', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('broadcasts', query, options)
  }
  count (query) {
    return super.count('broadcasts', query)
  }
  insertOne (data) {
    return super.insertOne('broadcasts', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('broadcasts', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('broadcasts', query, data)
  }
  deleteOne (query) {
    return super.deleteOne('broadcasts', query)
  }
}

module.exports = Broadcasts
