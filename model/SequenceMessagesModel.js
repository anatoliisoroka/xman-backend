const Model = require('./Model')

class SequenceMessages extends Model {
  find (query, options = {}) {
    return super.find('sequenceMessages', query, options)
  }
  deleteMany (query) {
    return super.deleteMany('sequenceMessages', query)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('sequenceMessages', query, data, options)
  }
  insertOne (data) {
    return super.insertOne('sequenceMessages', data)
  }
}

module.exports = SequenceMessages
