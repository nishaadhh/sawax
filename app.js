const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('./config/passport');
const User = require('./models/userSchema');
const MongoStore = require('connect-mongo');
dotenv.config();
const db = require('./config/db');
const nocache = require("nocache")
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRoutes');
const axios = require('axios');


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Changed to false to avoid empty sessions
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { secure: false, httpOnly: true, maxAge: 72 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});


app.use((req, res, next) => {
  res.locals.user = req.user
  next()
})


app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);
app.use('/admin',adminRouter );
// app.use('/signup', userRouter);
// app.use('/about', userRouter);





app.use('/admin',adminRouter)


app.get('/api/geocode/search', async (req, res) => {
    try {
        const { q } = req.query;
        const apiKey = process.env.GEOCODE_MAPS_CO_API_KEY || '68eb69ab749ab618160266qij4cc435';
        
        if (!q) {
            return res.status(400).json({ error: 'Missing search query (q parameter)' });
        }
        
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const apiUrl = `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=5&api_key=${apiKey}`;
        
        const response = await axios.get(apiUrl, { timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.error('Search proxy error:', error.message);
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

app.get('/api/geocode/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const apiKey = process.env.GEOCODE_MAPS_CO_API_KEY || '68eb69ab749ab618160266qij4cc435';
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        const apiUrl = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}&api_key=${apiKey}`;
        
        console.log(' Location getting geocoding for:', lat, lon);
        
        const response = await axios.get(apiUrl, { 
            timeout: 10000,
            headers: { 'User-Agent': 'YourApp/1.0' }
        });
        
        console.log(' Reverse geocode response structure:', Object.keys(response.data));
        if (response.data.address) {
            console.log(' Address components:', Object.keys(response.data.address));
        }
        
        res.json(response.data);
    } catch (error) {
        console.error(' location finding error:', error.response?.status, error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Reverse geocoding failed',
            details: error.response?.data || error.message 
        });
    }
});



db();
app.listen(3000, () => {
  console.log('http://localhost:3000');
});

module.exports = app;






