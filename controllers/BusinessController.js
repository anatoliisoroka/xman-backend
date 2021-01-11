const Controller = require('./Controller')
const { Customers } = require('../model')

class BusinessController extends Controller {
  getName (req, res) {
    const { customerId } = req.body
    const query = { _id: super.oid(customerId) }
    new Customers()
      .findOne(query)
      .then(customer => res.json(customer.businessName))
      .catch(() => res.status(403).json({ error: 'something_went_wrong' }))
  }
}

module.exports = BusinessController
