const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PaymentService = require('../services/paymentService');
const { hasRole } = require('../middleware/rbac');

// Create payment intent for customer
router.post('/create-intent', [
  body('jobId').isUUID(),
  body('amount').isFloat({ min: 1 }),
  body('currency').isString().isLength({ min: 3, max: 3 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId, amount, currency = 'usd' } = req.body;
    
    // Verify job exists and belongs to customer
    const job = await PaymentService.verifyJobOwnership(jobId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        jobId,
        customerId: req.user.id,
        integration_check: 'accept_a_payment'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Save payment record
    await PaymentService.createPaymentRecord({
      jobId,
      customerId: req.user.id,
      amount,
      currency,
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending'
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    next(error);
  }
});

// Confirm payment (webhook endpoint)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await PaymentService.handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await PaymentService.handlePaymentFailure(failedPayment);
        break;

      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        await PaymentService.handlePaymentCancellation(canceledPayment);
        break;

      case 'charge.dispute.created':
        const dispute = event.data.object;
        await PaymentService.handleDispute(dispute);
        break;

      case 'account.updated':
        const account = event.data.object;
        await PaymentService.handleAccountUpdate(account);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment history for customer
router.get('/customer/history', [
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 50 }).optional(),
  query('status').isIn(['pending', 'completed', 'failed', 'refunded']).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      customerId: req.user.id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status
    };

    const result = await PaymentService.getCustomerPayments(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get payment details
router.get('/:paymentId', [
  param('paymentId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payment = await PaymentService.getPaymentById(req.params.paymentId, req.user.id);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

// Request refund
router.post('/:paymentId/refund', [
  param('paymentId').isUUID(),
  body('reason').isString().isLength({ min: 10 }),
  body('amount').isFloat({ min: 0 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason, amount } = req.body;
    const result = await PaymentService.requestRefund(req.params.paymentId, req.user.id, reason, amount);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Driver payout routes
router.post('/driver/connect-account', [
  body('country').isString().isLength({ min: 2, max: 2 }),
  body('email').isEmail()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { country, email } = req.body;
    
    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/driver/payments/refresh`,
      return_url: `${process.env.FRONTEND_URL}/driver/payments/success`,
      type: 'account_onboarding'
    });

    // Save Connect account to driver profile
    await PaymentService.saveDriverConnectAccount(req.user.id, account.id);

    res.json({
      accountId: account.id,
      onboardingUrl: accountLink.url
    });
  } catch (error) {
    next(error);
  }
});

router.get('/driver/earnings', [
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 50 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      driverId: req.user.id,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await PaymentService.getDriverEarnings(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/driver/withdraw', [
  body('amount').isFloat({ min: 1 }),
  body('destination').isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, destination } = req.body;
    
    // Verify driver has Connect account
    const driverAccount = await PaymentService.getDriverConnectAccount(req.user.id);
    if (!driverAccount) {
      return res.status(400).json({ error: 'No connected account found' });
    }

    // Create payout
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination
    }, {
      stripeAccount: driverAccount.accountId
    });

    // Record payout
    await PaymentService.recordPayout(req.user.id, payout.id, amount);

    res.json({
      payoutId: payout.id,
      amount,
      status: payout.status
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.get('/admin/all', [
  hasRole(['admin', 'super_admin']),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional(),
  query('status').isIn(['pending', 'completed', 'failed', 'refunded', 'disputed']).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status
    };

    const result = await PaymentService.getAllPayments(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/admin/:paymentId/refund', [
  hasRole(['admin', 'super_admin']),
  param('paymentId').isUUID(),
  body('amount').isFloat({ min: 0 }).optional(),
  body('reason').isString().isLength({ min: 5 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason } = req.body;
    const result = await PaymentService.processRefund(req.params.paymentId, amount, reason, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/admin/analytics', [
  hasRole(['admin', 'super_admin']),
  query('startDate').isISO8601(),
  query('endDate').isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    const analytics = await PaymentService.getPaymentAnalytics(startDate, endDate);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;