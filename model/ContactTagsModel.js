const Model = require('./Model')

class ContactTags extends Model {
  find (query, options = {}) {
    return super.find('contactTags', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('contactTags', query, options)
  }
  insertOne (data) {
    return super.insertOne('contactTags', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('contactTags', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('contactTags', query, data)
  }
  deleteOne (query) {
    return super.deleteOne('contactTags', query)
  }
  deleteMany (query) {
    return super.deleteMany('contactTags', query)
  }
}

module.exports = ContactTags
