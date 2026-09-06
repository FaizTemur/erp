const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

// ---------- PROJECTS ----------

router.get('/projects', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM projects ORDER BY project_id DESC'));
}));

router.post('/projects', ah(async (req, res) => {
  const { project_name, location, description } = req.body;
  if (!project_name) return res.status(400).json({ error: 'project_name is required' });
  const id = await dbMod.run(
    'INSERT INTO projects (project_name, location, description) VALUES (?, ?, ?)',
    [project_name, location || null, description || null]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM projects WHERE project_id = ?', [id]));
}));

// ---------- BLOCKS ----------

router.get('/projects/:projectId/blocks', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM blocks WHERE project_id = ?', [req.params.projectId]));
}));

router.post('/projects/:projectId/blocks', ah(async (req, res) => {
  const { block_name } = req.body;
  if (!block_name) return res.status(400).json({ error: 'block_name is required' });
  const id = await dbMod.run(
    'INSERT INTO blocks (project_id, block_name) VALUES (?, ?)',
    [req.params.projectId, block_name]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM blocks WHERE block_id = ?', [id]));
}));

// ---------- PLOT TYPES ----------

router.get('/plot-types', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM plot_types'));
}));

// ---------- PLOTS ----------

router.get('/plots', ah(async (req, res) => {
  const { project_id, status, plot_code } = req.query;
  let sql = `SELECT p.*, pr.project_name, b.block_name, pt.type_name
             FROM plots p
             LEFT JOIN projects pr ON p.project_id = pr.project_id
             LEFT JOIN blocks b ON p.block_id = b.block_id
             LEFT JOIN plot_types pt ON p.plot_type_id = pt.plot_type_id
             WHERE 1=1`;
  const params = [];
  if (project_id) { sql += ' AND p.project_id = ?'; params.push(project_id); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (plot_code) { sql += ' AND p.plot_code = ?'; params.push(plot_code); }
  sql += ' ORDER BY p.plot_id DESC';
  res.json(await dbMod.all(sql, params));
}));

router.get('/plots/:id', ah(async (req, res) => {
  const plot = await dbMod.get(
    `SELECT p.*, pr.project_name, b.block_name, pt.type_name
     FROM plots p
     LEFT JOIN projects pr ON p.project_id = pr.project_id
     LEFT JOIN blocks b ON p.block_id = b.block_id
     LEFT JOIN plot_types pt ON p.plot_type_id = pt.plot_type_id
     WHERE p.plot_id = ?`,
    [req.params.id]
  );
  if (!plot) return res.status(404).json({ error: 'Plot not found' });

  const currentOwner = await dbMod.get(
    `SELECT oh.*, c.full_name, c.phone, c.cnic
     FROM ownership_history oh
     JOIN customers c ON oh.customer_id = c.customer_id
     WHERE oh.plot_id = ? AND oh.is_current = 1
     ORDER BY oh.start_date DESC LIMIT 1`,
    [plot.plot_id]
  );

  let contract = null;
  if (currentOwner) {
    contract = await dbMod.get(
      'SELECT * FROM sale_contracts WHERE ownership_id = ? ORDER BY contract_id DESC LIMIT 1',
      [currentOwner.ownership_id]
    );
  }

  res.json({ ...plot, current_owner: currentOwner || null, contract });
}));

router.post('/plots', ah(async (req, res) => {
  const {
    plot_code, project_id, block_id, plot_type_id, plot_number,
    khasra_number, width_ft, length_ft, marla, square_feet,
    category, base_price
  } = req.body;

  if (!plot_code || !project_id) {
    return res.status(400).json({ error: 'plot_code and project_id are required' });
  }

  const existing = await dbMod.get('SELECT plot_id FROM plots WHERE plot_code = ?', [plot_code]);
  if (existing) return res.status(409).json({ error: `plot_code ${plot_code} already exists` });

  const id = await dbMod.run(
    `INSERT INTO plots
     (plot_code, project_id, block_id, plot_type_id, plot_number, khasra_number,
      width_ft, length_ft, marla, square_feet, category, base_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [plot_code, project_id, block_id || null, plot_type_id || null, plot_number || null,
     khasra_number || null, width_ft || null, length_ft || null, marla || null,
     square_feet || null, category || null, base_price || null]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM plots WHERE plot_id = ?', [id]));
}));

// Bulk creation: generates plot_code sequentially, e.g. prefix "A-" + numbers 1..count
router.post('/plots/bulk', ah(async (req, res) => {
  const {
    project_id, block_id, plot_type_id, prefix, start_number, count,
    marla, square_feet, base_price, category
  } = req.body;

  if (!project_id || !prefix || !start_number || !count) {
    return res.status(400).json({ error: 'project_id, prefix, start_number, count are required' });
  }

  const created = [];
  for (let i = 0; i < count; i++) {
    const plotNumber = start_number + i;
    const plot_code = `${prefix}${plotNumber}`;
    const existing = await dbMod.get('SELECT plot_id FROM plots WHERE plot_code = ?', [plot_code]);
    if (existing) continue;
    const id = await dbMod.run(
      `INSERT INTO plots
       (plot_code, project_id, block_id, plot_type_id, plot_number, marla, square_feet, base_price, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [plot_code, project_id, block_id || null, plot_type_id || null, String(plotNumber),
       marla || null, square_feet || null, base_price || null, category || null]
    );
    created.push(id);
  }
  res.status(201).json({ created_count: created.length, plot_ids: created });
}));

router.put('/plots/:id', ah(async (req, res) => {
  const fields = ['plot_number', 'khasra_number', 'width_ft', 'length_ft', 'marla',
    'square_feet', 'category', 'base_price', 'status', 'block_id', 'plot_type_id'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  await dbMod.run(`UPDATE plots SET ${updates.join(', ')} WHERE plot_id = ?`, params);
  res.json(await dbMod.get('SELECT * FROM plots WHERE plot_id = ?', [req.params.id]));
}));

router.get('/plots/:id/legacy-ledger', ah(async (req, res) => {
  const entries = await dbMod.all(
    'SELECT * FROM legacy_ledger WHERE plot_id = ? ORDER BY entry_date, entry_id',
    [req.params.id]
  );
  res.json(entries);
}));

module.exports = router;
