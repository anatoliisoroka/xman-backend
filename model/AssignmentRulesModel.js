const Model = require('./Model')

class AssignmentRules extends Model {
  find (query, options = {}) {
    return super.find('assignmentRules', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('assignmentRules', query, options)
  }
  insertOne (data) {
    return super.insertOne('assignmentRules', data)
  }
  deleteOne (query) {
    return super.deleteOne('assignmentRules', query)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('assignmentRules', query, data, options)
  }
  updateMany (query, data) {
    return super.updateMany('assignmentRules', query, data)
  }
}

module.exports = AssignmentRules
