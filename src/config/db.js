const mysql = require('mysql2/promise');
const { getDbConfig } = require('./dbOptions');

const pool = mysql.createPool(getDbConfig());

module.exports = pool;
