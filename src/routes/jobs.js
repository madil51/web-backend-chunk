const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const JobService = require('../services/jobService');
const { hasRole } = require('../middleware/rbac');
const authenticateJWT = require('../middleware/authenticateJWT');


// Create a new job request
router.post('/create', authenticateJWT, [
  body('address').isString().isLength({ min: 5 }),
  body('phone').isString().isLength({ min: 10 }),
  body('contactMethod').isIn(['phone', 'email', 'both']),
  body('description').isString().isLength({ min: 10 }),
  body('category').isIn(['furniture', 'appliances', 'electronics', 'construction', 'yard', 'general', 'other']),
  body('volume').isIn(['small', 'medium', 'large']),
  body('serviceType').isIn(['asap', 'scheduled']),
  body('pricingPreference').isIn(['ai', 'bidding']),
  body('mediaFiles').isArray().optional(),
  body('scheduledDate').isISO8601().optional(),
  body('instructions').isString().optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const jobData = {
      ...req.body,
      customerId: req.user.id
    };

    const result = await JobService.createJob(jobData);
    res.status(201).json(result);
  } catch (error) {
    console.error('DB insert error:', error);
    next(error);
  }
});


// Get customer's jobs
router.get('/customer', [
  query('status').isIn(['pending', 'active', 'completed', 'cancelled']).optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 50 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      customerId: req.user.id,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await JobService.getCustomerJobs(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get single job details
router.get('/:jobId', [
  param('jobId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const job = await JobService.getJobById(req.params.jobId, req.user.id);
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Update job status (for customers)
router.put('/:jobId/status', [
  param('jobId').isUUID(),
  body('status').isIn(['cancelled']),
  body('reason').isString().optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.updateJobStatus(req.params.jobId, req.user.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Accept a bid
router.post('/:jobId/accept-bid', [
  param('jobId').isUUID(),
  body('bidId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.acceptBid(req.params.jobId, req.body.bidId, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Rate and review completed job
router.post('/:jobId/rate', [
  param('jobId').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('review').isString().isLength({ min: 10 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.rateJob(req.params.jobId, req.user.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


// Admin routes
router.get('/admin/all', [
  hasRole(['admin', 'super_admin']),
  query('status').isIn(['pending', 'active', 'completed', 'cancelled']).optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await JobService.getAllJobs(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/admin/:jobId/reassign', [
  hasRole(['admin', 'super_admin']),
  param('jobId').isUUID(),
  body('driverId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.reassignJob(req.params.jobId, req.body.driverId, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;