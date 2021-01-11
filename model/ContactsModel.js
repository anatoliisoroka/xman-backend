const Model = require('./Model')

class Contacts extends Model {
  find (query, options = {}) {
    return super.find('contacts', query, options)
  }
  paginate (query, skip, limit) {
    return super.paginate('contacts', query, skip, limit)
  }
  findOne (query, options = {}) {
    return super.findOne('contacts', query, options)
  }
  count (query) {
    return super.count('contacts', query)
  }
  insertOne (data) {
    return super.insertOne('contacts', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('contacts', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('contacts', query, data)
  }
  deleteOne (query) {
    return super.deleteOne('contacts', query)
  }
}

module.exports = Contacts
