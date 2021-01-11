const Model = require('./Model')

class Mentions extends Model {
  find (query, options = {}) {
    return super.find('mentions', query, options)
  }
  insertOne (data) {
    return super.insertOne('mentions', data)
  }
  deleteMany (query) {
    return super.deleteMany('mentions', query)
  }
  updateMany (query, data) {
    return super.updateMany('mentions', query, data)
  }
}

module.exports = Mentions
