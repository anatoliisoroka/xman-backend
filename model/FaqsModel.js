const Model = require('./Model')

class Faqs extends Model {
  find (query, options = {}) {
    return super.find('faqs', query, options)
  }
  insertOne (data) {
    return super.insertOne('faqs', data)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('faqs', query, data, options)
  }
  deleteOne (query) {
    return super.deleteMany('faqs', query)
  }
}

module.exports = Faqs
