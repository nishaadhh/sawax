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



//ADMIN SIDE

app.use('/admin',adminRouter)



db();
app.listen(3000, () => {
  console.log('http://localhost:3000');
});

module.exports = app;





// Error handling middleware

//app.get('/test', (req, res, next) => {
//   const err = new Error('Test error');
//   next(err); // Pass the error to the error handling middleware
// });

// app.listen(3000, () => console.log('Server running on port 3000'));
