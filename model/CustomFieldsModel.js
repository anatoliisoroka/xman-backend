const Model = require('./Model')

class CustomFields extends Model {
  find (query, options = {}) {
    return super.find('customFields', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('customFields', query, options)
  }
  insertOne (data) {
    return super.insertOne('customFields', data)
  }
  deleteMany (query) {
    return super.deleteMany('customFields', query)
  }
}

module.exports = CustomFields
