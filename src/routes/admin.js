const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const AdminService = require('../services/adminService');
const { hasRole } = require('../middleware/rbac');

// Dashboard analytics
router.get('/dashboard', [
  hasRole(['admin', 'super_admin'])
], async (req, res, next) => {
  try {
    const analytics = await AdminService.getDashboardAnalytics();
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// User management
router.get('/users', [
  hasRole(['admin', 'super_admin']),
  query('role').isIn(['customer', 'driver', 'admin']).optional(),
  query('status').isIn(['active', 'suspended', 'pending']).optional(),
  query('search').isString().optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      role: req.query.role,
      status: req.query.status,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AdminService.getUsers(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/users/:userId', [
  hasRole(['admin', 'super_admin']),
  param('userId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await AdminService.getUserById(req.params.userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/users/:userId/status', [
  hasRole(['admin', 'super_admin']),
  param('userId').isUUID(),
  body('status').isIn(['active', 'suspended']),
  body('reason').isString().isLength({ min: 5 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.updateUserStatus(
      req.params.userId, 
      req.body.status, 
      req.body.reason,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', [
  hasRole(['super_admin']),
  param('userId').isUUID(),
  body('reason').isString().isLength({ min: 5 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.deleteUser(
      req.params.userId, 
      req.body.reason,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Driver verification
router.get('/drivers/pending-verification', [
  hasRole(['admin', 'super_admin']),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 50 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AdminService.getPendingDriverVerifications(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/drivers/:driverId/verify', [
  hasRole(['admin', 'super_admin']),
  param('driverId').isUUID(),
  body('status').isIn(['approved', 'rejected']),
  body('notes').isString().optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.verifyDriver(
      req.params.driverId,
      req.body.status,
      req.body.notes,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Job management
router.get('/jobs', [
  hasRole(['admin', 'super_admin']),
  query('status').isIn(['pending', 'active', 'completed', 'cancelled', 'disputed']).optional(),
  query('customerId').isUUID().optional(),
  query('driverId').isUUID().optional(),
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
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
      customerId: req.query.customerId,
      driverId: req.query.driverId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AdminService.getJobs(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/jobs/:jobId/reassign', [
  hasRole(['admin', 'super_admin']),
  param('jobId').isUUID(),
  body('driverId').isUUID(),
  body('reason').isString().isLength({ min: 5 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.reassignJob(
      req.params.jobId,
      req.body.driverId,
      req.body.reason,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/jobs/:jobId/cancel', [
  hasRole(['admin', 'super_admin']),
  param('jobId').isUUID(),
  body('reason').isString().isLength({ min: 5 }),
  body('refundAmount').isFloat({ min: 0 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.cancelJob(
      req.params.jobId,
      req.body.reason,
      req.body.refundAmount,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Payment management
router.get('/payments', [
  hasRole(['admin', 'super_admin']),
  query('status').isIn(['pending', 'completed', 'failed', 'refunded', 'disputed']).optional(),
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
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
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AdminService.getPayments(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/payments/:paymentId/refund', [
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

    const result = await AdminService.processRefund(
      req.params.paymentId,
      req.body.amount,
      req.body.reason,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Dispute management
router.get('/disputes', [
  hasRole(['admin', 'super_admin']),
  query('status').isIn(['open', 'investigating', 'resolved', 'closed']).optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 50 }).optional()
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

    const result = await AdminService.getDisputes(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/disputes/:disputeId/status', [
  hasRole(['admin', 'super_admin']),
  param('disputeId').isUUID(),
  body('status').isIn(['investigating', 'resolved', 'closed']),
  body('resolution').isString().optional(),
  body('refundAmount').isFloat({ min: 0 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.updateDisputeStatus(
      req.params.disputeId,
      req.body.status,
      req.body.resolution,
      req.body.refundAmount,
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// System settings
router.get('/settings', [
  hasRole(['admin', 'super_admin'])
], async (req, res, next) => {
  try {
    const settings = await AdminService.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put('/settings', [
  hasRole(['super_admin']),
  body('commissionRate').isFloat({ min: 0, max: 100 }).optional(),
  body('aiPricingEnabled').isBoolean().optional(),
  body('minimumJobAmount').isFloat({ min: 0 }).optional(),
  body('autoDispatchEnabled').isBoolean().optional(),
  body('maxBidDuration').isInt({ min: 1, max: 60 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.updateSettings(req.body, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Admin management (super admin only)
router.post('/admins/invite', [
  hasRole(['super_admin']),
  body('email').isEmail(),
  body('role').isIn(['admin', 'operations_admin', 'finance_admin', 'support_admin', 'analytics_admin']),
  body('name').isString().isLength({ min: 2 }),
  body('permissions').isArray().optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.inviteAdmin(req.body, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/admins/:adminId', [
  hasRole(['super_admin']),
  param('adminId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await AdminService.removeAdmin(req.params.adminId, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Activity logs
router.get('/activity-logs', [
  hasRole(['admin', 'super_admin']),
  query('userId').isUUID().optional(),
  query('action').isString().optional(),
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      userId: req.query.userId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AdminService.getActivityLogs(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;