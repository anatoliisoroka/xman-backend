const Model = require('./Model')

class Sequences extends Model {
  findOne (query, options = {}) {
    return super.findOne('sequences', query, options)
  }
  find (query, options = {}) {
    return super.find('sequences', query, options)
  }
  count (query) {
    return super.count('sequences', query)
  }
  insertOne (data) {
    return super.insertOne('sequences', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('sequences', query, data, options)
  }
  deleteOne (query) {
    return super.deleteOne('sequences', query)
  }
}

module.exports = Sequences
