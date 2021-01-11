const { ObjectId } = require('mongodb')

class Controller {
  oid (id) {
    return (typeof id === 'string') ? ObjectId(id) : id
  }
}

module.exports = Controller
