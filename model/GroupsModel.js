const Model = require('./Model')

class Groups extends Model {
  find (query, options = {}) {
    return super.find('groups', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('groups', query, options)
  }
  insertOne (data) {
    return super.insertOne('groups', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('groups', query, data, options)
  }
}

module.exports = Groups
