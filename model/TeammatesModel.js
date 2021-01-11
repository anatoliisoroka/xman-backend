const Model = require('./Model')

class Teammates extends Model {
  find (query, options = {}) {
    return super.find('teammates', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('teammates', query, options)
  }
  count (query) {
    return super.count('teammates', query)
  }
  insertOne (data) {
    return super.insertOne('teammates', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('teammates', query, data, options)
  }
  deleteOne (query) {
    return super.deleteOne('teammates', query)
  }
}

module.exports = Teammates
