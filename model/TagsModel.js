const Model = require('./Model')

class Tags extends Model {
  find (query, options = {}) {
    return super.find('tags', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('tags', query, options)
  }
  insertOne (data) {
    return super.insertOne('tags', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('tags', query, data, options)
  }
  deleteOne (query) {
    return super.deleteOne('tags', query)
  }
}

module.exports = Tags
