const db = require('../config/db'); // assuming you have a DB config
const { v4: uuidv4 } = require('uuid');

module.exports = {
  createJob: async (jobData) => {
    const jobId = uuidv4();
    const query = `
    INSERT INTO jobs (
      id, customer_id, address, phone, contact_method,
      description, category, volume, service_type,
      pricing_preference, media_files, scheduled_date,
      instructions, status, created_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, NOW()
    )
    RETURNING *;
  `;

    const values = [
      jobId,
      jobData.customerId,
      jobData.address,
      jobData.phone,
      jobData.contactMethod,
      jobData.description,
      jobData.category,
      jobData.volume,
      jobData.serviceType,
      jobData.pricingPreference,
      JSON.stringify(jobData.mediaFiles || []),
      jobData.scheduledDate || null,
      jobData.instructions || null,
      'pending'
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  getAvailableJobs: async () => {
    const result = await db.query('SELECT * FROM jobs WHERE status = $1', ['pending']);
    return result.rows;
  },

  submitBid: async (jobId, driverId, bidAmount) => {
    const query = `
      INSERT INTO bids (job_id, driver_id, amount, submitted_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `;
    const result = await db.query(query, [jobId, driverId, bidAmount]);
    return result.rows[0];
  },

  updateJobStatus: async (jobId, status) => {
    const result = await db.query(
      'UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *;',
      [status, jobId]
    );
    return result.rows[0];
  }
};
