const { createCheckoutSession } = require('../lib/stripe-vigie974');
module.exports = (req, res) => createCheckoutSession(req, res);
