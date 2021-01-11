const Model = require('./Model')

class ContactRemarks extends Model {
  find (query, options = {}) {
    return super.find('contactRemarks', query, options)
  }
  insertOne (data) {
    return super.insertOne('contactRemarks', data)
  }
  deleteMany (query) {
    return super.deleteMany('contactRemarks', query)
  }
  updateMany (query, data) {
    return super.updateMany('contactRemarks', query, data)
  }
}

module.exports = ContactRemarks
