const logger = require('pino')

class Logging {
  constructor (activity) {
    this.activity = activity
  }

  log (service, type, response) {
    const { activity } = this
    return { service, activity, type, response }
  }

  success (service, response) {
    const isProduction = (process.env.NODE_ENV === 'production')
    if (isProduction) {
      const log = this.log(service, 'success', response)
      logger().info(log)
    }
  }

  error (service, error) {
    const log = this.log(service, 'error', error)
    logger().error(log)
  }
}

module.exports = Logging
