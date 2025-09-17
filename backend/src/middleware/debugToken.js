const express = require('express');

// Capturar el token que realmente llega a ventas
const capturarToken = (req, res, next) => {
    console.log('=== TOKEN DEBUG VENTAS ===');
    console.log('Headers Authorization:', req.headers.authorization);
    console.log('Path:', req.path);
    console.log('Method:', req.method);
    console.log('Query:', req.query);
    console.log('==========================');
    next();
};

module.exports = capturarToken;
