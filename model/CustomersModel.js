const Model = require('./Model')

class Customers extends Model {
  find (query, options = {}) {
    return super.find('customers', query, options)
  }
  findOne (query, options = {}) {
    return super.findOne('customers', query, options)
  }
  updateOne (query, data, options = {}) {
    return super.updateOne('customers', query, data, options)
  }
}

module.exports = Customers
