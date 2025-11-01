const express = require('express');
const router = express.Router();
const { query, param, body, validationResult } = require('express-validator');
const JobService = require('../services/jobService');
const authenticateJWT = require('../middleware/authenticateJWT');

// Get available jobs for driver
router.get('/available-jobs', authenticateJWT, [
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { lat, lng, radius } = req.query;

    let jobs;
    if (lat && lng) {
      jobs = await JobService.getAvailableJobsForDriver({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius: parseInt(radius) || 25
      });
    } else {
      jobs = await JobService.getAvailableJobs(); // fallback if no location
    }

    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

// Get driver's assigned jobs
router.get('/my-jobs', authenticateJWT, [
  query('status').optional().isIn(['active', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const options = {
      driverId: req.user.id,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const jobs = await JobService.getDriverJobs(options);
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

// Place a bid on a job
router.post('/:jobId/bid', authenticateJWT, [
  param('jobId').isUUID(),
  body('amount').isFloat({ min: 0 }),
  body('eta').isISO8601(),
  body('notes').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const bidData = {
      ...req.body,
      driverId: req.user.id,
      jobId: req.params.jobId
    };

    const result = await JobService.placeBid(bidData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:jobId/accept', [
  param('jobId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.acceptJob(req.params.jobId, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:jobId/complete', [
  param('jobId').isUUID(),
  body('completionPhotos').isArray().optional(),
  body('notes').isString().optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.completeJob(req.params.jobId, req.user.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:jobId/update-location', [
  param('jobId').isUUID(),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await JobService.updateDriverLocation(req.params.jobId, req.user.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
