const express = require('express');
const fileRoutes = require('./routes/fileRoutes');
const authRoutes = require('./routes/authRoutes');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
//app.use(express.json());
//app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/files', fileRoutes);
app.use('/api/auth', authRoutes);

// Serve the upload page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'upload.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running. Open http://localhost:${PORT} in a web browser.`);
});