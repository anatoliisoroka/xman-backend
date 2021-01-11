const Model = require('./Model')

class Keywords extends Model {
  find (query, options = {}) {
    return super.find('keywords', query, options)
  }
  count (query) {
    return super.count('keywords', query)
  }
  insertOne (data) {
    return super.insertOne('keywords', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('keywords', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('keywords', query, data)
  }
  deleteOne (query) {
    return super.deleteOne('keywords', query)
  }
}

module.exports = Keywords
